# Molecule Craft game design contracts

この文書は、現在の実装値ではなく、今後の変更でも維持すべき**永続的なゲーム設計判断**をまとめるsource of truthです。具体的な責務は `architecture.md`、H/C/O探索のproduction仕様は `hco-growth.md`、未実装の構想は `planning/` を参照してください。

## Core loop

Molecule Craftの中心は次の循環です。

```text
探索して元素を集める
→ 3Dで分子を手作業する
→ 分子を発見する
→ LOADOUTで用途に合う分子を選ぶ
→ BASE STOCKから出発時に必要量を錬成する
→ 分子の性質を使って次の探索を変える
```

図鑑埋めだけを目的にせず、**分子を作ることが攻略手段を増やし、探索が次のクラフト材料を生む**関係を維持します。

## Chemistry data and game-role data are separate

- `data/molecules.json` は構造・名称などの化学／分子事実DBです。
- fuel / propellant / oxidizer / coolant等のゲーム性能は `src/veil/molecule-roles.js` が所有します。
- DBに分子が存在することと、プレイヤーが発見・利用可能であることは別です。
- `src/veil/growth.js` の進行用メタデータには未知信号・序盤進行との結合があるため、ゲーム役割データを無造作に統合しません。
- 全分子へ特殊能力を割り当てる必要はありません。教育・発見対象だけの分子があってよい設計です。

## Choice over strict tiers

新しい分子は原則として「完全上位互換」ではなく、別の攻略余地を増やします。

優先する差は、例えば次のようなtrade-offです。

- 瞬間出力 vs 使用回数
- 点火応答 vs 巡航効率
- 燃料効率 vs O₂需要
- 高出力 vs 発熱
- 強い短時間冷却 vs 弱い長時間冷却
- 資源競合 vs 専門性能

現実の化学・物理は選択を理解しやすくする根拠として使いますが、工学シミュレータ化は目的ではありません。ゲーム内で一貫した物理的方向性を保ちつつ、遊びやすさのための圧縮・抽象化を許容します。

## Multiple-solutions principle

フィールドや進行を、特定分子IDの所持判定だけで開閉しません。

```text
分子Xを持っていない → 通行不可
```

よりも、複数の構成で同じ問題を異なる効率・コスト・操作難度で解ける状態を優先します。ルート、障害、熱、逆流等は物理量・資源量へ連続的に作用させ、分子IDを鍵穴にしません。

例外として序盤のH → C → O進行など、学習順序を守るための明示的なprogression gateは存在できます。ただし、DB登録だけで序盤を飛び越えないことを優先します。

## Resource and persistence boundaries

- クラフトworkspaceへ置いた原子はBASE STOCKから一時的にcheckoutされます。
- 削除・片付けで原子はBASE STOCKへ戻ります。
- 結合・結合解除・立体変形は追加資源を消費しません。
- 完成したworkspace分子は発見・設計であり、消費用の完成分子在庫ではありません。
- LOADOUT選択自体では原子を消費せず、出発確定時に必要な不足分だけBASE STOCKから錬成します。
- 通常飛行は常に可能で、推進資源が尽きても移動不能にはしません。
- 正常帰還は現在遠征のcargoを100%保持します。
- 強制帰還で失うのは現在遠征の未回収cargoだけで、BASE STOCK、図鑑、発見、恒久進行を失いません。

## Exploration identity

探索はRisk / Reward loopです。

```text
collect
→ もう少し奥へ／もう少し長く滞在
→ pressureが上がる
→ propulsion resourceを使う
→ voluntary returnかforced return
```

- H₂ BURSTは短時間の緊急・精密推進であり、恒久速度buffではありません。
- COMBUSTION DRIVEは持続高速移動です。
- Coolantは長時間DRIVEを成立させる熱管理であり、通常飛行の必須資源ではありません。
- DUST EATERは戦闘敵ではなく、Collector Shellの保持場を崩す追跡圧力です。
- FLOW / CHAINは主に視覚・音・リズムのfeedbackで、暗黙の速度／吸引性能buffにしません。

## World construction invariants

- ルート線は理想航路の手掛かりであり、プレイヤーを不可視レールへ拘束しません。
- 障害・報酬・熱・敵等はroute geometryと分離し、route feature/socketとして組み合わせます。
- 在庫量によるfield depletionは採集物の存在量を変えてよい一方、同seedの固定landmark、route、physical currentの乱数系列を変えません。
- 高性能装備があるほど有利にはなり得ますが、単一の正解装備だけを要求しません。

詳細は `route-kit.md` と `hco-growth.md` を参照してください。

## UI information budget

UIは次を優先します。

- visible objects
- direct manipulation
- meters / gauges
- short operational labels
- motion and state transitions

長いtutorial、性能表の暗記、説明文の重複は避けます。内部モデルが複雑でも、プレイヤーが比較する情報は少数の意味ある差へ圧縮します。主要ループは狭いmobile幅でも成立させます。

## Retired directions

明示的な再設計なしに復活させません。

- CRAFT完成分子からタンクへ直接長押し充填するmanual tank-charge
- 完成分子を消費在庫として保持する設計
- Discovery Islandを主要ゲームループへ戻すこと
- H₂所有による恒久的な移動／吸引buff
- FLOW / CHAINによる隠れ性能buff
- H₂Oを必須の分子鍵にすること
- DUST EATERを通常のcombat enemyへ変えること
- 説明文中心のsupply UI
- 完成構造へROTATABLE / LOCKED等の恒常スタンプを載せること

## Future work

CHO後の未実装方向性は `planning/molecule-craft-astra-direction-brief.md` に限定して管理します。候補やアイデアはproduction契約ではなく、実装タスクで明示的に採用された時点で現行docsへ昇格させます。
