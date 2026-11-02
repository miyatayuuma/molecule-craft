"""Regenerate molecule and part summary readings without a browser-side dictionary.

Requires: pip install janome==0.5.0
Run from anywhere: python scripts/generate-encyclopedia-furigana.py
Review chemical names and contextual readings before committing the generated data.
"""

import json
import re
from pathlib import Path

from janome.tokenizer import Tokenizer


ROOT = Path(__file__).resolve().parents[1]


def to_hiragana(value):
    return ''.join(chr(ord(char) - 0x60) if '\u30a1' <= char <= '\u30f6' else char for char in value)


def generate():
    encyclopedia = json.loads((ROOT / 'data/encyclopedia.json').read_text(encoding='utf-8'))
    tokenizer = Tokenizer()
    result = {'schemaVersion': 1, 'molecules': {}, 'parts': {}}
    for kind in ('molecules', 'parts'):
        for entry_id, entry in encyclopedia[kind].items():
            text = entry['description']
            annotations = []
            offset = 0
            for token in tokenizer.tokenize(text):
                surface = token.surface
                assert text.startswith(surface, offset), (entry_id, offset, surface)
                if re.search('[一-龯々]', surface):
                    reading = token.reading
                    # Janome needs small, reviewed overrides for two chemistry contexts.
                    if surface == '含' and reading == '*':
                        reading = 'ガン'
                    if surface == '共' and text.startswith('共重合', offset):
                        reading = 'キョウ'
                    if surface == '基' and text[:offset].endswith('カルボキシ'):
                        reading = 'キ'
                    # The glossary makes 肥料 a separate tappable word.
                    if surface == '窒素肥料':
                        annotations.extend([[offset, '窒素', 'ちっそ'], [offset + 2, '肥料', 'ひりょう']])
                        offset += len(surface)
                        continue
                    if reading == '*':
                        raise ValueError(f'Reading needs review: {entry_id}, {offset}, {surface}')
                    annotations.append([offset, surface, to_hiragana(reading)])
                offset += len(surface)
            assert offset == len(text), entry_id
            result[kind][entry_id] = annotations

    target = ROOT / 'data/encyclopedia-furigana.json'
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    generate()
