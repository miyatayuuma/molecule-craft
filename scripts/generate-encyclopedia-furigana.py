"""Regenerate Kanji-only readings for molecule/part summaries and glossary popups.

Requires: pip install janome==0.5.0
Run: python scripts/generate-encyclopedia-furigana.py
Review contextual/chemical readings before committing the generated data.
"""

import json
import re
from pathlib import Path

from janome.tokenizer import Tokenizer


ROOT = Path(__file__).resolve().parents[1]
KANJI = re.compile(r'[一-龯々]+')
PIECES = re.compile(r'[一-龯々]+|[^一-龯々]+')
GLOSSARY_ENTRY = re.compile(r"^\s*\['([^']+)','([^']+)',[12]\],?$", re.MULTILINE)


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
    encyclopedia = json.loads((ROOT / 'data/encyclopedia.json').read_text(encoding='utf-8'))
    tokenizer = Tokenizer()
    result = {'schemaVersion': 2, 'molecules': {}, 'parts': {}, 'glossary': {}}
    for kind in ('molecules', 'parts'):
        for entry_id, entry in encyclopedia[kind].items():
            result[kind][entry_id] = annotate(entry['description'], tokenizer, entry_id)

    source = (ROOT / 'src/encyclopedia-glossary.js').read_text(encoding='utf-8')
    definitions = GLOSSARY_ENTRY.findall(source)
    if not definitions:
        raise ValueError('No glossary entries found')
    for word, meaning in definitions:
        result['glossary'][word] = annotate(meaning, tokenizer, f'glossary:{word}')

    target = ROOT / 'data/encyclopedia-furigana.json'
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    generate()
