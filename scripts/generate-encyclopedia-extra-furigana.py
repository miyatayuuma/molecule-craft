"""Generate full-sentence Kanji-only ruby for encyclopedia material.

Unlike the legacy summaries, this targets every text used in the science books.
The generated readings are a REVIEW CANDIDATE: tokenizer output must be audited
for chemistry, context, proper nouns, and okurigana before publishing.

Requires Janome 0.5.0, then run with --write to refresh the separate corpus.
Never edits the already curated encyclopedia-furigana.json.
"""

import argparse
import importlib.util
import json
import re
import subprocess
from pathlib import Path

from janome.tokenizer import Tokenizer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('curated_generator', ROOT / 'scripts/generate-encyclopedia-furigana.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

# Janome has no entries for several common material-science terms. These are
# explicit reviewed pronunciations, not inferred from the nearest character.
TOKEN_READINGS = {
    '硫': 'リュウ', '硫後': 'リュウゴ', '硫状態': 'リュウジョウタイ', '硫条件': 'リュウジョウケン',
    '耐油手': 'タイユテ', '耐油性': 'タイユセイ', '耐衝撃': 'タイショウゲキ',
    '耐薬品': 'タイヤクヒン', '膨潤': 'ボウジュン', '酪酸': 'ラクサン',
    '圧下': 'アッカ', '引性': 'インセイ', '描像': 'ビョウゾウ',
    # Generic-language dictionary readings are wrong in these chemical contexts.
    '化物': 'カブツ', '薬剤': 'ヤクザイ', '負': 'フ', '型': 'ガタ',
}

# Whole compounds get reviewed readings before ambiguous word boundary splits
# (the tokenizer alone treats 三方 as みかた, 錐 as きり, etc.).
COMPOUNDS = {
    # Japanese morphological tokenizers often mistake the first character of
    # scientific compounds for an ordinary verb, personal name, or place name.
    '二重結合': 'ニジュウケツゴウ',
    '単結合': 'タンケツゴウ',
    '分子式': 'ブンシシキ',
    '高分子': 'コウブンシ',
    '構成単位': 'コウセイタンイ',
    '化学反応': 'カガクハンノウ',
    '原子': 'ゲンシ',
    '分子': 'ブンシ',
    '結合': 'ケツゴウ',
    '反応': 'ハンノウ',
    '生成物': 'セイセイブツ',
    '原料': 'ゲンリョウ',
    '酸性': 'サンセイ',
    '塩基性': 'エンキセイ',
    '加熱': 'カネツ',
    '触媒': 'ショクバイ',
    '構造': 'コウゾウ',
    '酸素': 'サンソ',
    '水素': 'スイソ',
    '炭素': 'タンソ',
    '縮合': 'シュクゴウ',
    '重合': 'ジュウゴウ',
    '模型': 'モケイ',
    '条件': 'ジョウケン',
    '工程': 'コウテイ',
    '開環': 'カイカン',
    '主鎖': 'シュサ',
    '求核': 'キュウカク',
    '気相': 'キソウ',
    '結晶相': 'ケッショウソウ',
    '焼結': 'ショウケツ',
    '保湿剤': 'ホシツザイ',
    '濃硫酸': 'ノウリュウサン',
    '共重合': 'キョウジュウゴウ',
    '配位触媒': 'ハイイショクバイ',
    '三員環': 'サンインカン',
    '環化': 'カンカ',
    '芳香環': 'ホウコウカン',
    '官能基': 'カンノウキ',
    '加水分解': 'カスイブンカイ',
    '付加重合': 'フカジュウゴウ',
    '連鎖反応': 'レンサハンノウ',
    '求核剤': 'キュウカクザイ',
    '酸化還元': 'サンカカンゲン',
    '炭素主鎖': 'タンソシュサ',
    '側鎖': 'ソクサ',
    '直鎖': 'チョクサ',
    '鎖長': 'サチョウ',
    '共重合体': 'キョウジュウゴウタイ',
    '付加重合体': 'フカジュウゴウタイ',
    '重合体': 'ジュウゴウタイ',
    '炭素数': 'タンソスウ',
    '原子数': 'ゲンシスウ',
    '酸無水物': 'サンムスイブツ',
    '四塩化炭素': 'シエンカタンソ',
    '四面体': 'シメンタイ',
    '三角錐形': 'サンカクスイケイ',
    '四面体形': 'シメンタイケイ',
    '水和': 'スイワ',
    '頭尾結合': 'トウビケツゴウ',
    '鎖形成': 'サケイセイ',
    '網目': 'アミメ',
    '不斉': 'フセイ',
    'ナイロン塩': 'ナイロンエン',
    'ナトリウム塩': 'ナトリウムエン',
    'カルシウム塩': 'カルシウムエン',
    '塩の形': 'エンノカタチ',
    # Never annotate the whole phrase: a repeated や caused 薬剤=くざい.
    'その塩': 'ソノエン',
    '内円': 'ナイエン',
    '生成鎖': 'セイセイサ',
    '長鎖': 'チョウサ',
    '無極性鎖': 'ムキョクセイサ',
    '参考鎖': 'サンコウサ',
    'ポリマー鎖': 'ポリマーサ',
    '分子間': 'ブンシカン',
    '分子間力': 'ブンシカンリョク',
    '炭素間': 'タンソカン',
    '分子内': 'ブンシナイ',
    '主鎖内': 'シュサナイ',
    '芳香環内': 'ホウコウカンナイ',
    '粘度': 'ネンド',
    '配位': 'ハイイ',
    '反応器': 'ハンノウキ',
    '重縮合': 'ジュウシュクゴウ',
    '三方両錐形': 'サンポウリョウスイケイ',
    '三重結合': 'サンジュウケツゴウ',
    '炭素鎖': 'タンソサ',
    '懸濁': 'ケンダク',
    '多価': 'タカ',
    '正四面体': 'セイシメンタイ',
    '正四面体形': 'セイシメンタイケイ',
    '改質': 'カイシツ',
    '実鎖長': 'ジツサチョウ',
    '実工程': 'ジツコウテイ',
    'シアン化物': 'シアンカブツ',
    '水素化物': 'スイソカブツ',
    '塩化物': 'エンカブツ',
    '酸化物': 'サンカブツ',
    '硫化物': 'リュウカブツ',
    '炭化水素': 'タンカスイソ',
    '加硫': 'カリュウ',
    '耐油手袋': 'タイユテブクロ',
    '電子求引性': 'デンシキュウインセイ',
    '電子求引基': 'デンシキュウインキ',
    '酪酸': 'ラクサン',
    '膨潤': 'ボウジュン',
}
COMPOUND_PATTERN = re.compile('|'.join(map(re.escape, sorted(COMPOUNDS, key=len, reverse=True))))


def append_kanji_readings(result, offset, surface, katakana, full):
    reading = generator.to_hiragana(katakana)
    pieces = generator.PIECES.findall(surface)
    options = []

    def divide(index, position, readings):
        if index == len(pieces):
            if position == len(reading):
                options.append(readings)
            return
        piece = pieces[index]
        if generator.KANJI.fullmatch(piece):
            for end in range(position + 1, len(reading) + 1):
                divide(index + 1, end, readings + [(piece, reading[position:end])])
        else:
            kana = generator.to_hiragana(piece)
            if reading.startswith(kana, position):
                divide(index + 1, position + len(kana), readings)

    divide(0, 0, [])
    if not options:
        raise ValueError(f'Cannot split okurigana: {full}, {offset}, {surface}, {reading}')
    # In Japanese inflections the trailing kana is normally a suffix; with
    # repeated kana such as 低く=ひくく prefer the longest Kanji reading.
    selected = max(options, key=lambda spans: tuple(len(r) for _, r in spans))
    cursor = 0
    for piece in pieces:
        if generator.KANJI.fullmatch(piece):
            word, kana = selected.pop(0)
            result.append([offset + cursor, word, kana])
        cursor += len(piece)


def annotate(text, tokenizer):
    result = []
    cursor = 0
    for match in COMPOUND_PATTERN.finditer(text):
        if match.start() < cursor:
            continue
        result.extend(annotate_raw(text[cursor:match.start()], tokenizer, cursor, text))
        append_kanji_readings(result, match.start(), match.group(), COMPOUNDS[match.group()], text)
        cursor = match.end()
    result.extend(annotate_raw(text[cursor:], tokenizer, cursor, text))
    assert all(text[i:i + len(s)] == s for i, s, _ in result)
    return result


def annotate_raw(segment, tokenizer, base, full):
    result = []
    index = 0
    for token in tokenizer.tokenize(segment):
        surface = token.surface
        index = segment.find(surface, index)
        if index < 0:
            raise ValueError(f'Cannot align token [{surface}] in [{segment}]')
        offset = base + index
        if full[offset:offset + len(surface)] != surface:
            raise ValueError(f'Tokenization offset mismatch: [{surface}] at {offset} in [{full}]')
        if generator.KANJI.search(surface):
            reading = TOKEN_READINGS.get(surface, token.reading)
            if surface == '塩' and full.startswith('塩や薬剤', offset):
                reading = 'エン'
            if surface == '基':
                reading = 'キ'
            if surface == '環':
                reading = 'カン'
            if surface == '三重' and full.startswith('三重結合', offset):
                reading = 'サンジュウ'
            if surface == '間' and full[offset + len(surface):].startswith(('に', 'で')):
                reading = 'アイダ'
            if surface == '生' and full.startswith('生分解性', offset):
                reading = 'セイ'
            if surface == '共' and full.startswith('共重合', offset):
                reading = 'キョウ'
            if surface == '鎖' and full[:offset].endswith(('炭素','PVC','PVDF')):
                reading = 'サ'
            if surface == '塩' and full[:offset].endswith(('リン酸', 'カルシウム')):
                reading = 'エン'
            if surface == '黄' and full.startswith('黄緑色', offset):
                reading = 'オウ'
            if surface == '本' and full[:offset].endswith('1'):
                reading = 'ポン'
            if surface == '含' and reading == '*':
                reading = 'ガン'
            if surface == '酸' and full[offset + 1:offset + 3] in ('から', 'では'):
                reading = 'サン'
            if reading == '*':
                raise ValueError(f'Unknown reading [{surface}] in [{full}] at {offset}')
            append_kanji_readings(result, offset, surface, reading, full)
        index += len(surface)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    texts = json.loads(subprocess.check_output(['node', 'scripts/collect-encyclopedia-ruby-texts.mjs'], cwd=ROOT))
    tokenizer = Tokenizer()
    annotated = {}
    errors = []
    reviewed = json.loads((ROOT / 'data/encyclopedia-furigana.json').read_text(encoding='utf8'))
    encyclopedia = json.loads((ROOT / 'data/encyclopedia.json').read_text(encoding='utf8'))
    verified_texts = {}
    for kind in ('molecules', 'parts'):
        for entry_id, entry in encyclopedia[kind].items():
            verified_texts[entry['description']] = reviewed[kind][entry_id]
    for text in texts:
        try:
            annotated[text] = verified_texts.get(text) or annotate(text, tokenizer)
        except ValueError as error:
            errors.append(str(error))
    if errors:
        raise SystemExit(f'{len(errors)} unreviewed readings:\n' + '\n'.join(errors))
    result = {'schemaVersion': 1, 'texts': annotated}
    data = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    print(f'{len(annotated)} source strings; {sum(len(x) for x in annotated.values())} ruby spans; {len(data.encode())} bytes')
    if args.write:
        target = ROOT / 'data/encyclopedia-extra-furigana.json'
        target.write_text(data, encoding='utf8')
        print(f'Wrote {target.relative_to(ROOT)} (candidate for contextual review)')


if __name__ == '__main__':
    main()
