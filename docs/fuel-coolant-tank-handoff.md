# Fuel / Coolant / O2 Tank handoff

## Goal

探索装備差を数値上の上下ではなく、点火タイミング・ON/OFF・進入ライン・遠征全体の資源配分の差として成立させる。

プレイ画面に説明文を追加しない。性能差は挙動、ゲージ、既存の装備UIから理解できるようにする。

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
- `environmentTolerance`: 将来の高温環境用。現時点では未接続。

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

## Important unfinished work for Codex

### 1. Playtest and tune the acceleration curves

現在は加速度差の最初の実装。

必ず実機相当の探索プレイで、少なくとも以下を比較する。

- H2
- CH4
- C2H2 or DME
- propane
- n-hexane

確認点：
- 高応答がBURSTを侵食していないか。
- CH4が基準として扱いやすいか。
- 重巡航Fuelが単なる弱いFuelではなく、先読み点火で成立するか。
- 共通最高速は維持する。

必要なら `response` と `DRIVES.combustion.boostAcceleration` を調整する。

### 2. Long-burn advantage only if playtest needs it

現行packetはボタンを離しても残量を保存するため、ON/OFF自体に再点火コストはない。

加速度差だけでResponsive / Cruiseの操作差が不足する場合のみ、長時間連続燃焼に小さな効率メリットを追加する。

避けること：
- ボタンを離したのに推力が残る操作不能感。
- 再点火ごとに1packet丸ごと失う強い罰。

### 3. Couple `environmentTolerance` to future hot regions

現行のambient heatはまだFuel/Coolant消費へ本格接続されていない。

高温難所では、低tolerance coolantの実効持続が落ち、高tolerance glycol系が長く働く程度にする。

「特定Coolantでないと通れない扉」にはしない。

### 4. O2 tank repair / reinforcement system

これは未実装。保存・UI・材料加工まで一貫して実装する。

推奨進行：

1. **Elastomer Seal Repair**
   - 劣化したシール/微小リークを補修する恒久アップグレード。
   - O2の使用可能容量を回復する。
   - ゴムそのものが高圧容器を強化する設定にはしない。

2. **Composite Overwrap**
   - 樹脂をマトリクスとした炭素繊維複合材で圧力容器を補強する恒久アップグレード。
   - O2の定格容量をさらに増やす。

初期値36を基準に、例えば `36 -> 48 -> 72` 程度からプレイテストしてよいが固定値ではない。

重要：
- 毎遠征ゴム/樹脂を消費する維持費にはしない。
- 容量到達を難所のhard gateにしない。
- 小容量でも上手い操作なら突破可能、大容量なら奥まで行って正常帰還しやすい、という余力差にする。
- O2容量増加により長時間燃焼が可能になり、その結果Heat/Coolantが次の制約になる流れを狙う。

### 5. Material crafting abstraction

高分子鎖をクラフト画面で大量に手作業させない。

モノマー/関連分子の発見・クラフトを材料技術の入口にし、その後は加工としてSeal / Liner / Compositeを生成する。

具体的な材料分子はDB存在確認と進行設計をしてから確定する。

### 6. Field obstacles that expose the differences

単一難所 = 単一正解装備にはしない。

1遠征内に複数要求を混在させる。

- 短い周期逆流：Responsive Fuelが扱いやすい
- 長い曲線強流：Cruise Fuelの先読み点火が有利
- 高温長距離：Fuel heat + Coolant duration/tolerance
- Dust Eater帰還：往路で使い切らない判断

難所突破 -> Inspiration Reward -> Craft Target -> 新装備 -> 別ルート、のループへ接続する。

## Validation before merge

- `node tests/molecule-roles.test.mjs`
- `node tests/propulsion-profiles.test.mjs`
- `node tests/expedition-core.test.mjs`
- `node tests/veil.test.mjs`
- `node scripts/check-repository-hygiene.mjs`
- runtime asset変更後、最後にprecacheを再生成してPWA関連チェックを行う。
