"""Preview Kanji-only reading candidates for encyclopedia summaries and glossary popups.

Requires: pip install janome==0.5.0
Preview: python scripts/generate-encyclopedia-furigana.py
After reviewing EVERY changed reading, use --write --review-digest <reported digest>.
Do not treat the tokenizer's output as a verified chemical or contextual reading.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KANJI = re.compile(r'[一-龯々]+')
PIECES = re.compile(r'[一-龯々]+|[^一-龯々]+')
GLOSSARY_ENTRY = re.compile(
    r'^\s*\{term:("(?:\\.|[^"\\])*"),meaning:("(?:\\.|[^"\\])*"),summaryScope:"(?:both|parts)"',
    re.MULTILINE,
)


def to_hiragana(value):
    return ''.join(chr(ord(char) - 0x60) if '\u30a1' <= char <= '\u30f6' else char for char in value)


def append_kanji_readings(annotations, offset, surface, reading, context):
    """Attach a ruby reading to Kanji only, never to neighboring kana or okurigana."""
    reading = to_hiragana(reading)
    pieces = PIECES.findall(surface)
    position = 0
    relative = 0
    for index, piece in enumerate(pieces):
        if KANJI.fullmatch(piece):
            next_piece = pieces[index + 1] if index + 1 < len(pieces) else ''
            end = reading.find(to_hiragana(next_piece), position + 1) if next_piece else len(reading)
            if end <= position:
                raise ValueError(f'Cannot separate okurigana: {context}, {offset}, {surface}, {reading}')
            annotations.append([offset + relative, piece, reading[position:end]])
            position = end
        else:
            literal = to_hiragana(piece)
            if not reading.startswith(literal, position):
                raise ValueError(f'Kana mismatch: {context}, {offset}, {surface}, {reading}')
            position += len(literal)
        relative += len(piece)
    if position != len(reading):
        raise ValueError(f'Reading mismatch: {context}, {offset}, {surface}, {reading}')


def annotate(text, tokenizer, context):
    annotations = []
    offset = 0
    for token in tokenizer.tokenize(text):
        surface = token.surface
        assert text.startswith(surface, offset), (context, offset, surface)
        if KANJI.search(surface):
            reading = token.reading
            if surface == '含' and reading == '*':
                reading = 'ガン'
            if surface == '共' and text.startswith('共重合', offset):
                reading = 'キョウ'
            # The functional-group suffix is pronounced "ki" (OH基, アミノ基, etc.).
            if surface == '基':
                reading = 'キ'
            # Janome may interpret chemical-ring and triple-bond terms as names/places.
            if surface == '環':
                reading = 'カン'
            if surface == '三重' and text.startswith('三重結合', offset):
                reading = 'サンジュウ'
            # Standalone words are read differently from their common dictionary defaults.
            if surface == '間' and text[offset + len(surface):].startswith(('に', 'で')):
                reading = 'アイダ'
            if surface == '生' and text.startswith('生分解性', offset):
                reading = 'セイ'
            if surface == '本' and text[:offset].endswith('1'):
                reading = 'ポン'
            # Compound names must keep their on-yomi; a standalone character can
            # have a different kun-yomi (鎖=くさり, 塩=しお, etc.).
            if surface == '鎖' and text[:offset].endswith('炭素'):
                reading = 'サ'
            if surface == '塩' and (
                text[:offset].endswith(('リン酸', 'カルシウム'))
                or text.startswith('塩の形', offset)
            ):
                reading = 'エン'
            if surface == '濃' and text.startswith('濃硫酸', offset):
                reading = 'ノウ'
            if surface == '湿' and text[:offset].endswith('保') and text.startswith('湿剤', offset):
                reading = 'シツ'
            if surface == '黄' and text.startswith('黄緑色', offset):
                reading = 'オウ'
            # The glossary treats 肥料 as an individually tappable term.
            if surface == '窒素肥料':
                annotations.extend([[offset, '窒素', 'ちっそ'], [offset + 2, '肥料', 'ひりょう']])
                offset += len(surface)
                continue
            if reading == '*':
                raise ValueError(f'Reading needs review: {context}, {offset}, {surface}')
            append_kanji_readings(annotations, offset, surface, reading, context)
        offset += len(surface)
    assert offset == len(text), context
    return annotations


def generate():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Replace the reviewed data only after examining the reading diff')
    parser.add_argument('--review-digest', help='The digest printed by the preview of the exact candidate data')
    args = parser.parse_args()
    if args.review_digest and not args.write:
        parser.error('--review-digest requires --write')

    try:
        from janome.tokenizer import Tokenizer
    except ModuleNotFoundError as error:
        raise SystemExit('Janome is required for candidate generation: pip install janome==0.5.0') from error

    encyclopedia = json.loads((ROOT / 'data/encyclopedia.json').read_text(encoding='utf-8'))
    tokenizer = Tokenizer()
    result = {'schemaVersion': 2, 'molecules': {}, 'parts': {}, 'glossary': {}}
    for kind in ('molecules', 'parts'):
        for entry_id, entry in encyclopedia[kind].items():
            result[kind][entry_id] = annotate(entry['description'], tokenizer, entry_id)

    source = (ROOT / 'src/encyclopedia-term-catalog.js').read_text(encoding='utf-8')
    definitions = [(json.loads(word), json.loads(meaning)) for word, meaning in GLOSSARY_ENTRY.findall(source)]
    if not definitions:
        raise ValueError('No glossary entries found')
    for word, meaning in definitions:
        result['glossary'][word] = annotate(meaning, tokenizer, f'glossary:{word}')

    target = ROOT / 'data/encyclopedia-furigana.json'
    candidate = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    changes = []
    for kind in ('molecules', 'parts', 'glossary'):
        old_entries = previous.get(kind, {})
        new_entries = result[kind]
        for entry_id in sorted(set(old_entries) | set(new_entries)):
            old_readings = {(offset, surface): reading for offset, surface, reading in old_entries.get(entry_id, [])}
            new_readings = {(offset, surface): reading for offset, surface, reading in new_entries.get(entry_id, [])}
            if old_readings == new_readings:
                continue
            source = (encyclopedia[kind][entry_id]['description'] if kind != 'glossary'
                      else dict(definitions)[entry_id]) if entry_id in new_entries else ''
            for offset, surface in sorted(set(old_readings) | set(new_readings)):
                before = old_readings.get((offset, surface), '∅')
                after = new_readings.get((offset, surface), '∅')
                if before == after:
                    continue
                context = source[max(0, offset - 5):offset + len(surface) + 5]
                changes.append(f'{kind}/{entry_id} [{context}] {surface}: {before} → {after}')

    if not changes:
        print('No reading changes; the reviewed encyclopedia furigana is unchanged.')
        return
    digest = hashlib.sha256(candidate.encode('utf-8')).hexdigest()[:16]
    print(f'{len(changes)} candidate changes require contextual reading review:')
    for change in changes:
        print('  ' + change)
    print(f'Review digest: {digest}')
    if not args.write:
        print('Preview only. The reviewed data was NOT modified.')
        return
    if args.review_digest != digest:
        parser.error('Review every changed reading first, then pass --review-digest ' + digest)
    target.write_text(candidate, encoding='utf-8')
    print('Reviewed candidate written. Run the encyclopedia furigana and glossary tests.')


if __name__ == '__main__':
    generate()
