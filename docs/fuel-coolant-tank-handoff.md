# Fuel / Coolant / O2 Tank handoff

## Goal

探索装備差を数値上の上下ではなく、点火タイミング・ON/OFF・進入ライン・遠征全体の資源配分の差として成立させる。

プレイ画面に説明文を追加しない。性能差は挙動、ゲージ、既存の装備UIから理解できるようにする。

## Context / token budget guardrails

このタスクではコンテキスト消費を最小化する。既存の `AGENTS.md` と本ファイルを起点にし、必要な担当ファイルだけを読む。

- 最初からリポジトリ全体を読み込まない。
- 原則として `src/veil/molecule-roles.js`, `growth.js`, `engine.js`, `resources.js`, `supply.js` と対応テストだけを対象にする。`config.js`, `universe.js`, UI周辺は実際に変更が必要になった時だけ開く。
- `src/app.js`、Git履歴、過去PR/Issue、`vendor/`、生成SVG、生成済みprecacheは、具体的な不具合原因の調査が必要な場合を除き読まない。
- 材料候補のDB確認では `data/molecules.json` 全文を読まず、必要な分子ID・名称だけ検索して該当レコードを読む。
- 無関係なリファクタや「ついでの整理」を行わない。変更は今回のFuel / Coolant / O2 tank系に限定する。
- 各工程では担当テストだけを実行する。失敗した場合も、失敗箇所と直接依存だけを追加調査する。
- 下記の最終Validation一式は、仕上げ前に原則1回だけ実行する。関連コードをその後変更した場合のみ、影響するテストを再実行する。
- precache再生成はruntime asset変更がすべて確定した最後に1回行う。
- commit / PR更新 / mergeのためだけにファイルを再読込したり、通過済みテストを再実行したりしない。
- 既存の `fuel-coolant-profiles-v2` / Draft PR #63 をそのまま継続し、同内容の別branch・別PRを作らない。

## Implemented on `fuel-coolant-profiles-v2`

### Fuel response

- 全FuelのCOMBUSTION DRIVE最高速は共通。
- Fuel profileに `response` を追加。
- `combustionDriveFor()` がFuelごとの加速度を生成し、探索ランタイムで使用する。
- H2 / C2H2 / methanol / DMEは高応答。
- CH4は基準。
- 長鎖炭化水素ほど立ち上がりを遅くした。
- 既存の `energy / oxygenPerFuel / heatFactor / capacity` は維持。

狙い：
- 高応答Fuel = 遅く点火しても間に合い、細かいON/OFFに向く。
- 重巡航Fuel = 難所前から点火して速度を作る必要がある。
- Propellant BURSTほど瞬間的にはしない。

### Coolant time profile

Coolant profileを以下へ分離した。

- `coolingPower`: 単位時間あたりの冷却強度
- `durationFactor`: 1分子が働く時間
- `environmentTolerance`: 高温環境での実効持続減少を緩和する。

ランタイムで `durationFactor` を実際のcoolant bufferへ反映済み。

方向性：
- N2 / NH3 = 短時間・強冷却
- water = 基準型
- ethylene glycol / propylene glycol = 弱いが長時間
- methanol / ethanol / CO2 = 中間系

満タン時の総冷却予算が極端に離れすぎないよう、強度と持続を概ね相殺している。

### Regression tests

- `tests/molecule-roles.test.mjs`
  - role balance v2
  - Fuel response ordering
  - coolant strong/short vs weak/long ordering
- `tests/propulsion-profiles.test.mjs`
  - 共通最高速
  - H2 > CH4 > n-hexane の加速応答
  - N2とethylene glycolの実ランタイム冷却差

## PR #63 completion / 2026-09-08

### Acceleration decision

既存responseを維持。実エンジン60fps、静穏区間、開始速度29から共通最高速470の90%へ到達する時間：

| Fuel | 90%到達（秒） | 0.2秒時の速度 |
| --- | ---: | ---: |
| H₂ | 0.283 | 382.0 |
| CH₄ | 0.433 | 314.1 |
| C₂H₂ | 0.300 | 372.4 |
| DME | 0.317 | 369.3 |
| propane | 0.550 | 278.1 |
| n-hexane | 0.783 | 223.7 |
| H₂ BURST（比較） | 0.033 | 757.3 |

BURST最高速760と瞬発力の役割は残る。点火前倒しでn-hexaneも周期区間を通過可能。周期区間の正常帰還まで、開始直後点火はH₂ 3.23秒／n-hexane 3.38秒、入口直前点火は4.93秒／5.12秒。応答差はあるが、この単一区間のタイム差だけでは装備優劣を決めない。連続燃焼ボーナス・再点火罰・離した後の自動推進は追加しない。支払い済み燃焼時間は保持する。

Chromiumの実Canvas画面・キーボードでも6 Fuelの加速、離した後の燃焼停止、支払い済み時間保持を確認。人間による主観的な操作感の評価は未確認。

### Permanent O₂ processing

| 加工 | 容量 | 発見済みレシピの条件 | 一度だけ支払うBASE STOCK |
| --- | ---: | --- | --- |
| 初期 | 36 | — | — |
| Elastomer Seal Repair | 48 | ethene + propene | C24 H48 |
| Composite Overwrap | 72 | phenol + formaldehyde | C96 H48 O16 |

第1段階は劣化シールと微小リークの補修による使用可能容量の回復。第2段階は樹脂マトリクス＋炭素繊維による容器補強。小分子のクラフトを加工技術の入口とする抽象化であり、加工費は工業的な合成反応式ではない。ゴムを圧力容器の耐圧材とせず、巨大高分子の手作業・部品在庫・遠征ごとの維持費も作らない。

schema v7に強化段階を保存。v6以前は容量36・強化なしへ移行し、既存タンク残量を保持。強化時にO₂は増殖せず、追加容量は別途補充する。保存失敗時は原子支払いと強化をロールバック。resources、補給メーター、容量表示、出発時loadout、飛行O₂ゲージ・推進予算へ反映。タンク初期化では強化もリセットする。

### Mixed expedition and coolant

任意の周期逆流（y -8350〜-8750）、曲線強流（-10820〜-11320）、高温区間（-11320〜-11600）を追加。流れの描画と物理は同じ領域を使う。側方の既存経路も使え、装備による通行可否判定はない。Dust Eaterと0.8秒の帰還ロックは既存処理を維持。

横断でDME／シール用分子、propane／複合材用分子、glycol／n-hexaneの既存ヒントを解放する。既存の帰還してクラフトする導線へ次の燃料・冷却剤を渡す。ブラウザで周期区間横断→DME報酬→正常帰還→制作目標へのイベントまで確認。完成レシピや装備を無料付与しない。

環境熱は機体に最大3.75 heat/秒を加え、冷却bufferの消費速度を `1 + 0.8 × ambientHeat / 100 / environmentTolerance` 倍にする。冷却強度と基本持続は維持。静かな渦の環境熱を軽減。N₂/NH₃の強冷却、waterの基準、glycolの弱く長い持続を維持する連続的な負荷であり、特定冷却剤の鍵穴ではない。

seed71、酸素アンカーから混合区間終端y=-11640へ向かい、敵・実タンク消費あり、熱75超で休止／35まで回復、危険時BURST、65秒上限の自動操作：

| Fuel | O₂容量 | Coolant | 正常帰還まで | 冷却剤残量 |
| --- | ---: | --- | ---: | ---: |
| n-hexane | 36 | water | 捕獲（35.25秒） | 49 / 80 |
| n-hexane | 36 | N₂ | 28.18秒 | 11 / 72 |
| n-hexane | 36 | NH₃ | 28.18秒 | 17 / 60 |
| n-hexane | 36 | ethylene glycol | 捕獲（38.65秒） | 23 / 32 |
| n-hexane | 48 | water | 48.28秒 | 25 / 80 |
| n-hexane | 48 | N₂ | 23.28秒 | 3 / 72 |
| n-hexane | 48 | NH₃ | 23.28秒 | 12 / 60 |
| n-hexane | 48 | ethylene glycol | 45.80秒 | 17 / 32 |

容量72はこの終端では48と同じ到達時間で、追加O₂が余力として残る。n-hexaneの満載時燃焼予算は容量36／48／72で約20.76／41.52／62.28秒。初期容量も通過可能で、増量後は冷却休止と敵への露出が次の制約になる。ただし強冷却はこの短い評価コースで速さに有利。glycolの残量は長期余力であり、全経路で最適との結論ではない。

代表のn-hexane / water / O₂48は30fpsで48.57秒、60fpsで48.28秒、いずれも正常帰還・冷却残25。これは固定操作の機械的比較であり、人間の成功率やCHO最終地点の攻略結果ではない。スクリプトはランタイムのタンク消費を使い、BASE STOCKの遠征収支全体は評価しない。

### Reproduction

```sh
node scripts/evaluate-propulsion-profiles.mjs > /tmp/fuel-profiles.json
node --input-type=module - <<'JS'
import {evaluateProfile} from './scripts/evaluate-propulsion-profiles.mjs';
for (const capacity of [36,48,72])
  for (const coolant of ['water','nitrogen','ammonia','ethylene-glycol'])
    console.log(evaluateProfile({fuel:'n-hexane',capacity,coolant}));
JS
# Serve repository, then provide an installed Playwright module path:
python3 -m http.server 8765
# In another terminal:
node tests/fuel-profiles-browser-check.mjs /absolute/path/to/playwright/index.mjs http://127.0.0.1:8765
```

追加テスト：`tank-upgrades.test.mjs`、`expedition-challenges.test.mjs`、`propulsion-profiles.test.mjs`。ブラウザ検証はモバイル幅390pxで実補給ボタン、36→48→72表示、実ランタイムと制作導線を使用する。次の調整判断は、人間による点火の先読み・視覚的な流れの読み取りの確認を基に行う。

## Validation before merge

- `node tests/molecule-roles.test.mjs`
- `node tests/propulsion-profiles.test.mjs`
- `node tests/expedition-core.test.mjs`
- `node tests/veil.test.mjs`
- `node scripts/check-repository-hygiene.mjs`
- runtime asset変更後、最後にprecacheを再生成してPWA関連チェックを行う。
