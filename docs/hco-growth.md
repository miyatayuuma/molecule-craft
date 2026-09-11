# CHO campaign / Expedition Core

この文書は、現在mainで稼働しているH/C/O探索、LOADOUT、推進、帰還、CHO完了条件のproduction契約です。ゲーム全体の永続原則は `game-design.md`、ルート部品は `route-kit.md`、未完の人間プレイ検証は `planning/cho-completion-roadmap.md` を参照してください。

## Campaign completion

CHO campaignの終点は `(280, -12470)`、到達半径95です。

- 終点到達はその遠征だけの `destinationReached` として扱います。
- **同じ遠征で通常の0.8秒ANCHOR LOCKを完了し、voluntary returnした時だけ** `progress.choCompleted` を保存します。
- 終点到達後に捕獲された場合は完了しません。
- 別遠征の安全帰還へ到達状態を持ち越しません。
- 完了後も既存のクラフト・探索・アンカーは利用できます。

初回プレイ目標は30〜60分ですが、人間の初見プレイではまだ検証していません。完了宣言のゲートは `planning/cho-completion-roadmap.md` にあります。

## Current loop

```text
基地でLOADOUTを選ぶ
→ Collector Shellを展開
→ H/C/Oを集める
→ stay / go deeperでpressureを上げる
→ BURST / DRIVE / coolingを使う
→ voluntary returnまたはforced return
→ BASE STOCKで分子を手作業して発見
→ 次のLOADOUTを更新
```

通常飛行は推進資源なしでも常に利用できます。FLOW / CHAINは移動速度、操舵、pickup radiusを変えません。

## LOADOUT and launch synthesis

現在のタンクは次の4用途です。

- propellant
- fuel
- oxidizer
- coolant

LOADOUTでは、**発見済みかつその用途に対応する分子**を各slotへ選びます。選択そのものではBASE STOCKを消費せず、既存タンク内容も変更しません。

出発時は `src/veil/resources.js` が選択LOADOUTと現在タンクを比較し、必要な不足分をBASE STOCKから自動錬成します。

- 十分な材料がある場合はFULL。
- 全満載には足りないが使用可能な量を組める場合はPARTIALとして確認対象になります。
- 有効な搭載を作れない場合はIMPOSSIBLEです。
- 同じ分子が既に入っているslotは残量を利用し、不足分だけ追加します。
- 別分子へ切り替えるslotは、出発commit時に旧内容を置き換えます。
- 空slotは空として出発します。
- LOADOUT選択は保存され、次回編集時の基準になります。

CRAFT workspaceにはタンク充填操作を置きません。完成模型は発見・制作設計であり、ユーザー向けのタンク補給境界はLOADOUT出発transactionです。完成分子の中間在庫は現行schemaに存在しません。

保存元 `molecule-craft.resources.v1` の現行内部schemaはv7です。旧schemaからのtank内容・進行互換を維持し、未来schemaや破損saveを保護します。

## Propulsion roles

### BURST

H₂は基準propellantです。

- tank capacity: 120
- 1 BURST: 40 molecules
- full tank: 3 uses
- short emergency / precision propulsion

他の登録propellantも `src/veil/molecule-roles.js` の `capacity` / `moleculesPerBurst` / `burstPower` に従って同じruntimeを使います。後発propellantはピーク出力と使用回数のtrade-offを持ちます。

### COMBUSTION DRIVE

FuelとO₂を消費する持続高速推進です。

- top-speedの基本役割は全fuelで共通。
- fuelごとの `response` が加速立ち上がりを変えます。
- `energy` と `oxygenPerFuel` が実際の燃焼packetと持続時間・O₂消費を決めます。
- 入力を離しても支払い済みpacket remainderは捨てません。
- fuelまたはO₂が不足すればDRIVEは停止しますが、通常飛行は継続できます。
- O₂は現在唯一のactive oxidizerです。

性能・容量の数値source of truthは `src/veil/molecule-roles.js` です。化学DBへゲーム性能を移しません。

## Heat and coolant

COMBUSTION DRIVEには独立した0–100のpropulsion heatがあります。

- sustained DRIVEでheatが増加します。
- overheatするとDRIVEを停止し、自然冷却後に再利用できます。
- coolantは自動thermostatからwhole-molecule単位で消費されます。
- coolantごとの `coolingPower` / `durationFactor` / `environmentTolerance` が強度、持続、高温環境での消費効率を分けます。
- BURSTと通常飛行はcoolant必須ではありません。
- ambient/environment heatはpropulsion heatへ負荷を加えますが、特定coolant IDの所持判定で通路を開閉しません。

Coolant候補は厳密なupgrade chainではなく、強い短時間冷却、基準型、弱い長時間型等の用途差を持ちます。

## Permanent O₂ processing

O₂ tankの恒久容量は次の3段階です。

| 段階 | 容量 | 解禁条件 | BASE STOCK加工費 |
|---|---:|---|---|
| initial | 36 | — | — |
| Elastomer Seal Repair | 48 | ethene + propeneを発見 | C24 H48 |
| Composite Overwrap | 72 | phenol + formaldehydeを発見 | C96 H48 O16 |

設計上の意味は、1段階目が劣化sealとmicro-leakの修復、2段階目が樹脂matrix／carbon-fibre overwrapによる圧力容器補強です。これは巨大高分子在庫や工業反応式を直接シミュレートせず、発見済み小分子を加工技術の入口として扱う抽象化です。

強化は容量だけを増やし、O₂そのものを無料生成しません。追加容量は通常のLOADOUT錬成で補充します。tank resetでは強化段階もresetします。

## Collector Shell, Dust Eater and return

操作対象は基地そのものではなく、一時的に展開されたCollector Shellです。

DUST EATERは生物型のcombat enemyではなく、Collector Shellのholding fieldを不安定化する追跡現象です。pressureは遠征時間と採集で増え、複数個体が退路を狭めます。

### Voluntary return

```text
ANCHOR LOCK 0.8s
→ stable RETRACT
→ current-sortie cargo 100% retained
```

lock中も物理と接触判定は有効です。

### Forced return

DUST EATER接触では、現在遠征cargoの15%だけを失ってemergency RETRACTします。

失わないもの：

- BASE STOCK
- tank contents
- recipes / discoveries
- encyclopedia state
- permanent upgrades / progression

元素の発見知識は、帰還前に捕獲されても巻き戻しません。

## H/C/O world and routes

現行worldはH Veil → Carbon Drift → Oxygen領域 → CHO最深部まで連続座標でつながります。酸素領域には、異なる流れ・採集効率・休止余地を持つ複数経路とvortex routeがあります。

重要なのは、route selectionを分子IDでlockしないことです。同じ区間でも、強いBURST、持続DRIVE、冷却しながらの巡航、休止、迂回など複数の解法を許します。

Route constructionの再利用境界は `route-kit.md` がsource of truthです。

## Stock-dependent field depletion

探索fieldは出発時の基地在庫を入力として生成します。在庫が多い元素ほど採集dustを減らせますが、次を維持します。

- 同じseedならfixed landmarkとroute位置を変えない。
- physical currentを在庫量で変えない。
- optional dust laneやclusterの有無は変わってよい。
- tankへ既に支払い済みの原子はBASE STOCKには含めません。
- 遠征途中の採集によって同じfieldを再生成しません。

この分離により、在庫抑制がroute navigationやseed比較そのものを壊さないようにします。

## Discovery and progression

fresh-saveの理解順はH → C → Oを維持します。

- HからH₂を手作業で発見してBURSTを得る。
- C到達後にCH₄を発見し、O到達後にO₂を発見してcombustionへ進む。
- H₂O / CO₂などは有用な選択肢ですが、CHO campaign完了の必須分子一覧にはしません。
- 正しい構造を自力で作った場合はhintより先に発見できます。
- role profileがDBにあるだけでは利用可能にしません。実際の発見と元素供給経路を必要とします。

`src/veil/molecule-roles.js` のrole登録と、`src/veil/growth.js` のprogression／unknown-signal metadataは分離します。role追加だけで序盤の未知信号順序を変えません。

## Source ownership

| Contract | Source |
|---|---|
| normal flight / expedition / thermal constants | `src/veil/config.js` |
| game-role performance / molecule capacity | `src/veil/molecule-roles.js` |
| progression metadata / shared drive behavior | `src/veil/growth.js` |
| resources / save / launch auto-synthesis / O₂ upgrade transaction | `src/veil/resources.js` |
| LOADOUT UI / launch selection | `src/veil/supply.js` |
| propulsion physics | `src/veil/engine.js` |
| route / dust / stock depletion | `src/veil/universe.js`, `src/veil/oxygen-routes.js` |
| reusable route geometry | `src/veil/route-kit.js`, `docs/route-kit.md` |
| CHO completion | `src/veil/cho-campaign.js`, `src/veil/resources.js` |

Exact tuning values in source take precedence over prose when they change together in a future gameplay task.

## Validation boundary

Mechanical regressions are covered by focused tests around expedition core, loadout launch, supply tanks, molecule roles, thermal/coolant, O₂ upgrades, routes and CHO completion. Human playtesting is still required for subjective difficulty, first-time comprehension and the 30–60 minute target; that unresolved work is tracked only in `planning/cho-completion-roadmap.md`.
