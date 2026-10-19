# All-25 routes — Task③ visual acceptance matrix

[Task③ visual specification](polymer-local-fragment-task3-visual-spec.md)と一体の規範仕様。[Task②教育表](polymer-local-fragment-task2-education-matrix.md)のID・E・Vを採用する。source `905ba4f1fb4a0e6d63e658a9f178ac29ad8beb49`。geometry/source rolesを画面方向・polymer名称から推測しない。

## Common fixture and acceptance rules

全25の再現fixtureは[evidence/analytical-projections.json](polymer-local-fragment-task3-evidence/analytical-projections.json)。実Coreに`representativeSequence`をu0…uN、generation1で投入、190step source preview→96iteration layout。graph、origins、source列、evidence、bond配列index、order別edge、carbonyl/CN、source aromaticCycles→final index、source別atom集合とgraph digestを保存。**このfixtureはブラウザSampleそのものではなく、同productionの決定的な比較入力**。旧PNGのsample/poseをこのfixtureで上書きしない。④でgeometryを変えてもgraph/tuple/selectorを保持する。

表の基本grammarとしてV0/V3を全件に適用。追加VはTask②の原文集合。主/副Eは変更しない。A01–A15、units、fit/gesture/capture規則はvisual spec参照。

- 初期camera preset I: actual canvas/S、48姿勢候補、radius込みtight fit、占有.70–.94、全atomの初期外切れなし、neutral annotation。全viewport360×780/390×844/1280×800、normal/reduced/DPR1を必須とする。
- 局所preset L: 選択集合と1bond shell、q≥20、A03/A04/A07。grid40viewsで全要求集合を回復し、同時比較対象は1viewにそろえる。Rはreset、Oはorbit、Zはzoom、Fはlocal focus。
- 全行でsource/evidenceの断定制限U0/M1–M9を保持。annotation fillは元素、originは破線枠/番号。V6実source→after→water、V8実Sample対別concept。未UIは将来⑤target、実装済み/PASSではない。
- Screenshotはroute−viewport−DPR−motion−stateのsidecar付。全route overview/reset、必要V state、local witnessを⑥で取得。代表C/SでDPR2も取得。未撮影はNOT_CAPTURED。子ども理解はTask②protocolで別採点。
- ④はactual XYZ/role→origin→final set/G0–G7。⑤は表示grammar/fit/UI/比較/resource。⑥検証IDはT3-R01…T3-R25 + A/V/C/S。全原子/結合は常時meshに保持、cropと削除を区別する。

行別の「④/⑤表示検証」はTask②の検証対象を引用しており、引用中の凡例/全表示等を④への実装指示とは読まない。実装責務は上の共通規則とvisual spec §14が優先し、④は座標と対象集合、⑤はmesh/凡例/UIに限定する。

## Inventory and per-route risk

| Polymer ID | Route ID | 主 / 副E | V requirements | 実構造・局所受入 | Camera / 操作 | 個別risk | Screenshot/state | 実装 / ⑥検証ID |
|---|---|---|---|---|---|---|---|---|
| `polyethylene` | `polyethylene-coordination` | E1 / E3 | V0 V3 V6 | E1両端を初期同時確認。C–C全経路はA07で端から端へ。V6は副段階のみ | I→O/Z/F→L→R | 末端Hと主鎖Cの投影重なり | C01; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R01・A01–A15該当・C01 |
| `polypropylene` | `polypropylene-coordination` | E2 / E1 | V0 V1 V3 | 一つのmethyl Cと3H、結合先主鎖C、隣接主鎖2edgeを同局所viewへ | I→O/Z/F→L→R | methylが主鎖と同方向へ隠れる | C02; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R02・A01–A15該当・C02 |
| `ethylene-propylene-copolymer` | `ethylene-propylene-coordination` | E4 / E2 | V0 V1 V3 V5 | ethene→propene→etheneのsource番号と中央methylを対比、全体2:1表示は禁止 | I→O/Z/F→L→R | 中央propene由来methylの隠れ/由来色の混同 | R03; overview/reset/local/source | ④XYZ/sets、⑤view/UI、⑥T3-R03・A01–A15該当・R03 |
| `polyisobutylene` | `polyisobutylene-cationic` | E2 / E1 | V0 V1 V3 | geminal methyl二C/各3Hと同一接点を同時識別、三本の高分子鎖とは呼ばない | I→O/Z/F→L→R | 同一Cの二つのmethylが一つに重なる | S12; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R04・A01–A15該当・S12 |
| `polystyrene` | `polystyrene-radical` | E2 / E1 | V0 V1 V2 V3 | 全4環の閉路各6edgeと各一付着。代表一環を同時trace、Hを消さない | I→O/Z/F→L→R | 四側環が投影で重なる/環の背面edge | C03; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R05・A01–A15該当・C03 |
| `polyvinyl-chloride` | `polyvinyl-chloride-radical` | E2 / E1 | V0 V1 V3 | 全4Clと実C–Clを回復。Cl文字凡例、遊離Cl表現禁止 | I→O/Z/F→L→R | 大きいClがC–Cl/隣接主鎖を覆う | R06; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R06・A01–A15該当・R06 |
| `polychlorotrifluoroethylene` | `polychlorotrifluoroethylene-radical` | E2 / E1 | V0 V1 V3 | 全F/Clのsymbol/nameと実接合、同局所viewにF/Cl一対とCを表示 | I→O/Z/F→L→R | FとClの近似色/halogen shellでCが隠れる | S14; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R07・A01–A15該当・S14 |
| `polyacrylonitrile` | `polyacrylonitrile-radical` | E2 / E1 | V0 V1 V3 | 全4C≡Nで3lane/2gapを局所回復、同view内の主鎖singleと比較。L1必須 | I→O/Z/F→L→R | CNがend-on/3laneが2laneに潰れる | C07; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R08・A01–A15該当・C07 |
| `polyacrylic-acid` | `polyacrylic-acid-radical` | E2 / E1 | V0 V1 V3 V4 | 4つのC(=O)OHを局所回復。OHの実Hを含めC=O/O–Hを区別、主鎖内esterと混同しない | I→O/Z/F→L→R | acid OHとcarbonyl Oの重なり | S16; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R09・A01–A15該当・S16 |
| `polyethylene-oxide` | `polyethylene-oxide-anionic-ring-opening` | E3 / E2 | V0 V3 V4 V6 | 前ethylene-oxide三員環と後の同tuple経路、後μ0/ringOpenings4/water0 | I→O/Z/F→L→R | OがHに埋もれる/完成片に元の環を誤描画 | C06; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R10・A01–A15該当・C06 |
| `polyethylene-terephthalate` | `polyethylene-terephthalate-direct-polycondensation` | E3 / E2,E4 | V0 V2 V3 V4 V5 V6 | 二環は両側接続。3ester/3water/ports0。sourceと水partitionを別stateで照合 | I→O/Z/F→L→R | 二主鎖環/ester密集/長い二種残基 | C04; overview/reset/local/source/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R11・A01–A15該当・C04 |
| `polyethylene-adipate` | `polyethylene-adipate-direct-polycondensation` | E3 / E2 | V0 V3 V4 V5 V6 | 3esterと両端の実官能基、酸/glycol残基由来、3water。初期fit＋局所へ | I→O/Z/F→L→R | 長いadipic spanと小glycolのサイズ差 | R12; overview/reset/local/source/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R12・A01–A15該当・R12 |
| `polylactic-acid` | `polylactic-acid-direct-polycondensation` | E3 / E2 | V0 V1 V3 V4 V6 | self-condensationの3ester/3water、各methylと主鎖通過点。stereo断定不可 | I→O/Z/F→L→R | methylとester/OHの密集 | S16; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R13・A01–A15該当・S16 |
| `polyglycolic-acid` | `polyglycolic-acid-direct-polycondensation` | E3 / E2 | V0 V3 V4 V6 | 3esterと3water、実端基、methylなしを保つ。未表示Hやfake end cap禁止 | I→O/Z/F→L→R | carbonylとether様Oの取り違え | R14; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R14・A01–A15該当・R14 |
| `phenol-formaldehyde-resin` | `phenol-formaldehyde-resole` | E4 / E2,E3 | V0 V2 V3 V4 V6 V8 | 実二環/bridge/hydroxymethyl/1water、図鑑独立4環と別state。位置選択は未認証 | I→O/Z/F→L→R | 二環/メチレン/CH₂OHの重なり、L2 | C09; overview/reset/local/before/after/water/concept-separate | ④XYZ/sets、⑤view/UI、⑥T3-R15・A01–A15該当・C09 |
| `polyethylene-adipamide` | `polyethylene-adipamide-direct-polycondensation` | E3 / E2 | V0 V3 V4 V5 V6 | 3C(=O)–Nと実N–H、二種残基と3water。nylon66の六Cdiamineと取り違えない | I→O/Z/F→L→R | 柔軟な長いadipic span/amide N–Hの重なり | R16; overview/reset/local/source/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R16・A01–A15該当・R16 |
| `polybutadiene` | `polybutadiene-coordination-1-4` | E3 / E2 | V0 V3 V6 V7 | 主鎖内残存C=C4本をA04回復、原料二重結合の全消失と説明しない | I→O/Z/F→L→R | 残存C=Cのend-on/連続singleとの識別 | R17; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R17・A01–A15該当・R17 |
| `styrene-butadiene-copolymer` | `styrene-butadiene-radical` | E4 / E2,E3 | V0 V1 V2 V3 V5 V7 | BD→styrene→BD、環1/鎖C=C2を別集合、全体比や加硫架橋は不明 | I→O/Z/F→L→R | 側環order2と鎖内diene order2の混同 | C08; overview/reset/local/source | ④XYZ/sets、⑤view/UI、⑥T3-R18・A01–A15該当・C08 |
| `nitrile-butadiene-rubber` | `nitrile-butadiene-radical` | E4 / E2,E3 | V0 V1 V3 V5 V7 | 1/2/3の全edgegrammar、CN1とring外C=C2、二種原料番号、L1必須 | I→O/Z/F→L→R | C=CとC≡Nの同時判別/由来の重なり | S10; overview/reset/local/source | ④XYZ/sets、⑤view/UI、⑥T3-R19・A01–A15該当・S10 |
| `polyisoprene` | `polyisoprene-coordination-1-4` | E3 / E2 | V0 V1 V3 V6 V7 | 残存C=C4と実methyl、局所接続。cis/transや全体1,4比率断定禁止 | I→O/Z/F→L→R | methylが残存C=Cを覆う | R20; overview/reset/local/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R20・A01–A15該当・R20 |
| `butyl-rubber` | `butyl-rubber-cationic` | E4 / E2 | V0 V1 V3 V5 V7 | isobutene→isoprene→isobutene、実C=C1と二methyl、bulk割合不明 | I→O/Z/F→L→R | geminal methyl密集/少数dieneを見落とす | R21; overview/reset/local/source | ④XYZ/sets、⑤view/UI、⑥T3-R21・A01–A15該当・R21 |
| `polyvinylidene-fluoride` | `polyvinylidene-fluoride-radical` | E2 / E1 | V0 V1 V3 | 全F/C–FとC主鎖、実source位置だけ、結晶やhead-tail統計不明 | I→O/Z/F→L→R | Fが主鎖Cを覆う/規則的見た目からregio断定 | R22; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R22・A01–A15該当・R22 |
| `vinylidene-fluoride-hexafluoropropylene-copolymer` | `vinylidene-fluoride-hexafluoropropylene-radical` | E4 / E2 | V0 V1 V3 V5 | 中央HFP由来CF₃のC/F3と接点、VDF→HFP→VDFの番号。Fを削除しない | I→O/Z/F→L→R | CF₃ shell/二つのfluorinated source混同 | S15; overview/reset/local/source | ④XYZ/sets、⑤view/UI、⑥T3-R23・A01–A15該当・S15 |
| `polytetrafluoroethylene` | `polytetrafluoroethylene-radical` | E2 / E1 | V0 V1 V3 | 全C/F/全C–F、C backbone連続性を回転/局所で回復、helix/結晶表示禁止 | I→O/Z/F→L→R | F shellによるC主鎖遮蔽/helix誤断定 | S11; overview/reset/local | ④XYZ/sets、⑤view/UI、⑥T3-R24・A01–A15該当・S11 |
| `nylon-6-6` | `nylon-6-6-direct-polycondensation` | E3 / E2,E4 | V0 V3 V4 V5 V6 | 初期両端と全体、局所amide3とN–H、3water、六Cdiamine由来span。ports0保持 | I→O/Z/F→L→R | 最長79atom片/小さいamide/端切れ | C05 / S13; overview/reset/local/source/before/after/water | ④XYZ/sets、⑤view/UI、⑥T3-R25・A01–A15該当・C05 / S13 |

## Route-specific target sets and evidence

全配列indexはfixtureの**final graph**にのみ有効。実batchではorigin tupleとsource反応部位で再解決し検証する。数値indexの全batch共通化は禁止。全atom/全bondの保持は以下の部分集合にかかわらず必須。sourceの芳香環blockは全cycle edgeを含め、最短経路片側へ削らない。main-path resolverはroute反応site→実inter-unit heavy link→source内chemically annotated pathの順、ringはblock、移動Hは別由来のまま保持。語義selectorだけで検証済みとせず④がexpected tuple集合をassertする。

### R01. `polyethylene`

- Route ID: `polyethylene-coordination`。主/副目標: E1 / E3。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 実C–C主鎖を両端の間でたどる。近接するだけのHへ飛び移らない。
- fixture targets: inter-source heavy bond indices=`[3,11,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: E1両端を初期同時確認。C–C全経路はA07で端から端へ。V6は副段階のみ。末端Hと主鎖Cの投影重なりで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `ethene → ethene → ethene → ethene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: C01。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 全主鎖edgeの連続性と実端、元etheneのC=C変化と生成後のsingle bondを区別。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R01`と該当A/V/C01、未実施はNOT_RUN。
- 禁止/限界: U0; この短片が全高分子／完全にH終端した安定鎖。

### R02. `polypropylene`

- Route ID: `polypropylene-coordination`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 二原料接続を結ぶC主鎖から出るCH3とその一接続点。
- fixture targets: inter-source heavy bond indices=`[3,13,18]`; candidate methyl C indices=`[2,13,20,29]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 一つのmethyl Cと3H、結合先主鎖C、隣接主鎖2edgeを同局所viewへ。methylが主鎖と同方向へ隠れるで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `propene → propene → propene → propene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: C02。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 主鎖Cとmethyl Cの役割対応、隠れたHを含む全表示、回転後も接続点が区別可能。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R02`と該当A/V/C02、未実施はNOT_RUN。
- 禁止/限界: U0; isotactic/syndiotactic/atacticの確定、三方向鎖分岐。

### R03. `ethylene-propylene-copolymer`

- Route ID: `ethylene-propylene-coordination`。主/副目標: E4 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: ethene→propene→etheneの実局所列と中央由来のメチル。
- fixture targets: inter-source heavy bond indices=`[3,14]`; candidate methyl C indices=`[13]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: ethene→propene→etheneのsource番号と中央methylを対比、全体2:1表示は禁止。中央propene由来methylの隠れ/由来色の混同で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `ethene → propene → ethene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: R03。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 由来tupleによる二種識別、メチルと主鎖、局所列と全体未知の注釈分離。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R03`と該当A/V/R03、未実施はNOT_RUN。
- 禁止/限界: U0; bulk比率2:1、random/block/alternating分布。

### R04. `polyisobutylene`

- Route ID: `polyisobutylene-cationic`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 同じ置換主鎖Cから出る二つのメチル。高分子鎖の腕とは区別。
- fixture targets: inter-source heavy bond indices=`[3,21,24]`; candidate methyl C indices=`[10,11,21,22,34,35,40,41]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: geminal methyl二C/各3Hと同一接点を同時識別、三本の高分子鎖とは呼ばない。同一Cの二つのmethylが一つに重なるで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `isobutene → isobutene → isobutene → isobutene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: S12。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ geminal methyl二個の接続点と主鎖通過経路、H混雑を削除なしで解決。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R04`と該当A/V/S12、未実施はNOT_RUN。
- 禁止/限界: U0; 三本の高分子鎖が結んだjunction／固有のtacticity。

### R05. `polystyrene`

- Route ID: `polystyrene-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 主鎖から一つの結合でぶら下がる六C環を一周。
- fixture targets: inter-source heavy bond indices=`[22,24,49]`; source aromatic ring atom sets=`[[0,23,12,25,24,1],[46,13,11,10,9,47],[26,38,37,36,35,27],[48,59,58,57,56,49]]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全4環の閉路各6edgeと各一付着。代表一環を同時trace、Hを消さない。四側環が投影で重なる/環の背面edgeで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `styrene → styrene → styrene → styrene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: C03。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 四つの実環の閉路、側環の一付着とC主鎖を保持、ring平面/重なりと結合次数を確認。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R05`と該当A/V/C03、未実施はNOT_RUN。
- 禁止/限界: U0; 環状高分子／特定tacticity／結合交替から固定した電子状態。

### R06. `polyvinyl-chloride`

- Route ID: `polyvinyl-chloride-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: C主鎖に共有結合したClを凡例と結合で識別。
- fixture targets: inter-source heavy bond indices=`[3,11,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全4Clと実C–Clを回復。Cl文字凡例、遊離Cl表現禁止。大きいClがC–Cl/隣接主鎖を覆うで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `vinyl-chloride → vinyl-chloride → vinyl-chloride → vinyl-chloride`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: R06。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 元素Clと主鎖Cの非色覚凡例、全Cl/Hを保持、結合が重なりで消えない。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R06`と該当A/V/R06、未実施はNOT_RUN。
- 禁止/限界: U0; 材料の有害性・強度等をこの有限模型から測定したとの断定。

### R07. `polychlorotrifluoroethylene`

- Route ID: `polychlorotrifluoroethylene-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: FとClの置換基をC主鎖との結合で対比。
- fixture targets: inter-source heavy bond indices=`[3,11,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全F/Clのsymbol/nameと実接合、同局所viewにF/Cl一対とCを表示。FとClの近似色/halogen shellでCが隠れるで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `chlorotrifluoroethylene → chlorotrifluoroethylene → chlorotrifluoroethylene → chlorotrifluoroethylene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: S14。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ F/Clの元素凡例を別にし、C主鎖と各原子のedgeを回転後も確認。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R07`と該当A/V/S14、未実施はNOT_RUN。
- 禁止/限界: U0; tacticity／一様なbulk配置や結晶。

### R08. `polyacrylonitrile`

- Route ID: `polyacrylonitrile-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 側基C≡Nの実order3と主鎖single bond。
- fixture targets: inter-source heavy bond indices=`[1,10,18]`; nitrile C≡N bond indices=`[12,19,20,26]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全4C≡Nで3lane/2gapを局所回復、同view内の主鎖singleと比較。L1必須。CNがend-on/3laneが2laneに潰れるで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `acrylonitrile → acrylonitrile → acrylonitrile → acrylonitrile`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: C07。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 四C≡Nの次数3・local長さ/直線性を検証。L1:現rendererは2lane、⑤修正まで次数視覚受入未達。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R08`と該当A/V/C07、未実施はNOT_RUN。
- 禁止/限界: U0; order3をorder2と説明／炭素繊維の実物がこの構造だと断定。

### R09. `polyacrylic-acid`

- Route ID: `polyacrylic-acid-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 側基C(=O)OHと主鎖C経路。酸Hは実際に残る。
- fixture targets: inter-source heavy bond indices=`[3,13,18]`; carbonyl C=O bond indices=`[6,21,24,32]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 4つのC(=O)OHを局所回復。OHの実Hを含めC=O/O–Hを区別、主鎖内esterと混同しない。acid OHとcarbonyl Oの重なりで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `acrylic-acid → acrylic-acid → acrylic-acid → acrylic-acid`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: S16。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ carboxylのC=OとC–OH、保持されたHと主鎖の側接続を区別。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R09`と該当A/V/S16、未実施はNOT_RUN。
- 禁止/限界: U0; 酸解離・pH・材料性状をこのneutral実グラフだけで確定。

### R10. `polyethylene-oxide`

- Route ID: `polyethylene-oxide-anionic-ring-opening`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 元ethylene-oxide三員環と、生成後の環なしC–O–C主鎖。
- fixture targets: inter-source heavy bond indices=`[0,7,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 前ethylene-oxide三員環と後の同tuple経路、後μ0/ringOpenings4/water0。OがHに埋もれる/完成片に元の環を誤描画で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `ethylene-oxide → ethylene-oxide → ethylene-oxide → ethylene-oxide`、投入元4個、water 0個。元のepoxide閉路が開き、実ringOpenings=4。最終graphに環はない。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: C06。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 実ringOpenings4、cycle0、water0。実source状態と生成後を別提示、全ether Oを主鎖内に保持。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R10`と該当A/V/C06、未実施はNOT_RUN。
- 禁止/限界: U0; 完成片が環状／全etherが同じ開環過程を経るとの一般化。

### R11. `polyethylene-terephthalate`

- Route ID: `polyethylene-terephthalate-direct-polycondensation`。主/副目標: E3 / E2,E4。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 酸由来の環を通る連続性、glycol由来O、実esterと別の水。
- fixture targets: inter-source heavy bond indices=`[5,7,37]`; carbonyl C=O bond indices=`[9,27,36,38]`; source aromatic ring atom sets=`[[0,32,22,12,16,1],[17,28,27,26,25,18]]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 二環は両側接続。3ester/3water/ports0。sourceと水partitionを別stateで照合。二主鎖環/ester密集/長い二種残基で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `terephthalic-acid → ethylene-glycol → terephthalic-acid → ethylene-glycol`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: C04。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 二主鎖芳香環・三ester・三water・実端基/ports0、酸/glycol残基とCRU概念を分離。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R11`と該当A/V/C04、未実施はNOT_RUN。
- 禁止/限界: U0; 完全repeat数4または末端無視の2／完成片が閉じた環状全分子。

### R12. `polyethylene-adipate`

- Route ID: `polyethylene-adipate-direct-polycondensation`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: adipic-acidとglycol残基を結ぶC(=O)–O、実端基と水。
- fixture targets: inter-source heavy bond indices=`[1,13,38]`; carbonyl C=O bond indices=`[2,22,37,40]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 3esterと両端の実官能基、酸/glycol残基由来、3water。初期fit＋局所へ。長いadipic spanと小glycolのサイズ差で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → ethylene-glycol → adipic-acid → ethylene-glycol`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: R12。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 三ester/三water/ports0。柔軟spanの主鎖経路と端のacid/alcoholの区別。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R12`と該当A/V/R12、未実施はNOT_RUN。
- 禁止/限界: U0; 4完全repeat／生成後Oが全て水／未表示端の追加結合。

### R13. `polylactic-acid`

- Route ID: `polylactic-acid-direct-polycondensation`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 同じlactic-acid由来の残基間ester、水、横のメチル。
- fixture targets: inter-source heavy bond indices=`[10,23,24]`; carbonyl C=O bond indices=`[9,22,27,36]`; candidate methyl C indices=`[0,11,12,28]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: self-condensationの3ester/3water、各methylと主鎖通過点。stereo断定不可。methylとester/OHの密集で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `lactic-acid → lactic-acid → lactic-acid → lactic-acid`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: S16。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 三ester/三water、methyl側基とactual end groups。chiral配列をgeometryで確定しない。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R13`と該当A/V/S16、未実施はNOT_RUN。
- 禁止/限界: U0; 特定L/D配列やtacticity、完全repeatの無条件数え上げ。

### R14. `polyglycolic-acid`

- Route ID: `polyglycolic-acid-direct-polycondensation`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 同種glycolic-acid由来のesterと別分離した水。
- fixture targets: inter-source heavy bond indices=`[4,11,17]`; carbonyl C=O bond indices=`[5,10,16,23]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 3esterと3water、実端基、methylなしを保つ。未表示Hやfake end cap禁止。carbonylとether様Oの取り違えで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `glycolic-acid → glycolic-acid → glycolic-acid → glycolic-acid`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: R14。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 三ester/三water/ports0、carbonylと単結合O、酸/alcohol末端を保持。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R14`と該当A/V/R14、未実施はNOT_RUN。
- 禁止/限界: U0; 末端を消した無限鎖／この模型から分解速度を確定。

### R15. `phenol-formaldehyde-resin`

- Route ID: `phenol-formaldehyde-resole`。主/副目標: E4 / E2,E3。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 実二環をつなぐCH2とCH2OH、別図のnetworkとの相違。
- fixture targets: inter-source heavy bond indices=`[4,17,22]`; source aromatic ring atom sets=`[[0,5,4,3,2,1],[7,16,15,14,13,8]]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 実二環/bridge/hydroxymethyl/1water、図鑑独立4環と別state。位置選択は未認証。二環/メチレン/CH₂OHの重なり、L2で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=4、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `phenol → formaldehyde → phenol → formaldehyde`、投入元4個、water 1個。実hydroxymethyl site形成（位置妥当性L2は未評価）。二環間の実methylene bridgeと水。
- source/反応UI: V6の実source/after/byproduct状態を必須。V8の独立networkを別identityで提示。元素fillの変更は禁止。
- Screenshot/state: C09。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 実二環/一methylene bridge/hydroxymethyl/一water/ports0、origin移動H、L2化学評価留保、独立SVGを別identity。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R15`と該当A/V/C09、未実施はNOT_RUN。
- 禁止/限界: U0; この実サンプルに三方向junction/鎖間架橋／標準ortho/para位置選択を検証済み。

### R16. `polyethylene-adipamide`

- Route ID: `polyethylene-adipamide-direct-polycondensation`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: adipic-acidとethylenediamine由来を結ぶC(=O)–Nと実water。
- fixture targets: inter-source heavy bond indices=`[1,7,40]`; carbonyl C=O bond indices=`[2,24,39,42]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 3C(=O)–Nと実N–H、二種残基と3water。nylon66の六Cdiamineと取り違えない。柔軟な長いadipic span/amide N–Hの重なりで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → ethylenediamine → adipic-acid → ethylenediamine`、投入元4個、water 3個。実C(=O)–N連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: R16。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 三amide/三water/ports0、carbonyl–NとN–H、二Cのdiamine由来spanを保持。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R16`と該当A/V/R16、未実施はNOT_RUN。
- 禁止/限界: U0; 4完全repeat／diamine鎖長をnylon66と同じと説明。

### R17. `polybutadiene`

- Route ID: `polybutadiene-coordination-1-4`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 元dieneの二C=Cと、1,4編集後に各原料由来に残るC=C。
- fixture targets: inter-source heavy bond indices=`[11,18,25]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 主鎖内残存C=C4本をA04回復、原料二重結合の全消失と説明しない。残存C=Cのend-on/連続singleとの識別で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → 1-3-butadiene → 1-3-butadiene → 1-3-butadiene`、投入元4個、water 0個。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: R17。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 四残存C=Cと実inter-unit single bonds、元dieneとの差分を保持。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R17`と該当A/V/R17、未実施はNOT_RUN。
- 禁止/限界: U0; 全材料のcis/trans・1,4/1,2比、unique conformer。

### R18. `styrene-butadiene-copolymer`

- Route ID: `styrene-butadiene-radical`。主/副目標: E4 / E2,E3。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: BD→styrene→BDの実由来列、側芳香環と鎖内残存C=C。
- fixture targets: inter-source heavy bond indices=`[23,24]`; source aromatic ring atom sets=`[[2,14,13,11,10,3]]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: BD→styrene→BD、環1/鎖C=C2を別集合、全体比や加硫架橋は不明。側環order2と鎖内diene order2の混同で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → styrene → 1-3-butadiene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: C08。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 一側環と二残存C=C、二種originsを別確認。芳香環order2をdiene残存数へ含めない。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R18`と該当A/V/C08、未実施はNOT_RUN。
- 禁止/限界: U0; random/block、全体比率、cis/trans分布、加硫済み架橋。

### R19. `nitrile-butadiene-rubber`

- Route ID: `nitrile-butadiene-radical`。主/副目標: E4 / E2,E3。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: BD→acrylonitrile→BD由来、C≡N一個と残存C=C二個。
- fixture targets: inter-source heavy bond indices=`[8,11]`; nitrile C≡N bond indices=`[12]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 1/2/3の全edgegrammar、CN1とring外C=C2、二種原料番号、L1必須。C=CとC≡Nの同時判別/由来の重なりで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → acrylonitrile → 1-3-butadiene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: S10。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ CN一order3とdiene二order2を別集合。L1現2lane制約を⑤で解消、nitrile geometryと全origin保存。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R19`と該当A/V/S10、未実施はNOT_RUN。
- 禁止/限界: U0; 全体組成比・cis/trans分布・random/block、加硫架橋の形成済み。

### R20. `polyisoprene`

- Route ID: `polyisoprene-coordination-1-4`。主/副目標: E3 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: 1,4編集後の四残存C=Cとmethyl側基。
- fixture targets: inter-source heavy bond indices=`[10,24,37]`; candidate methyl C indices=`[5,16,27,46]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 残存C=C4と実methyl、局所接続。cis/transや全体1,4比率断定禁止。methylが残存C=Cを覆うで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `isoprene → isoprene → isoprene → isoprene`、投入元4個、water 0個。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- source/反応UI: V6の実source/after/byproduct状態を必須。元素fillの変更は禁止。
- Screenshot/state: R20。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 四C=Cとmethyl側基、実1,4編集、cis/transを割り当てずにlocal bond geometry。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R20`と該当A/V/R20、未実施はNOT_RUN。
- 禁止/限界: U0; 天然ゴムのcis配列・微細構造比を確定。

### R21. `butyl-rubber`

- Route ID: `butyl-rubber-cationic`。主/副目標: E4 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: isobutene→isoprene→isobuteneと一残存C=C、geminal methyl。
- fixture targets: inter-source heavy bond indices=`[1,20]`; candidate methyl C indices=`[11,19,20,29,30]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: isobutene→isoprene→isobutene、実C=C1と二methyl、bulk割合不明。geminal methyl密集/少数dieneを見落とすで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `isobutene → isoprene → isobutene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: R21。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 一残存C=Cと混合origin、methyl二個の接続と鎖の連続性を区別。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R21`と該当A/V/R21、未実施はNOT_RUN。
- 禁止/限界: U0; bulk比率、random/block、架橋密度や加硫済み構造。

### R22. `polyvinylidene-fluoride`

- Route ID: `polyvinylidene-fluoride-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: F-bearing炭素とH-bearing炭素を含む実C主鎖。
- fixture targets: inter-source heavy bond indices=`[3,11,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全F/C–FとC主鎖、実source位置だけ、結晶やhead-tail統計不明。Fが主鎖Cを覆う/規則的見た目からregio断定で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `vinylidene-fluoride → vinylidene-fluoride → vinylidene-fluoride → vinylidene-fluoride`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: R22。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ F/H/C凡例とsource置換位置を保持、回転後もC主鎖経路を追跡可能。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R22`と該当A/V/R22、未実施はNOT_RUN。
- 禁止/限界: U0; bulk regioregularity、stereo、結晶相/圧電性を模型から確定。

### R23. `vinylidene-fluoride-hexafluoropropylene-copolymer`

- Route ID: `vinylidene-fluoride-hexafluoropropylene-radical`。主/副目標: E4 / E2。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: VDF→HFP→VDFのoriginとHFP由来CF3側基。
- fixture targets: inter-source heavy bond indices=`[3,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 中央HFP由来CF₃のC/F3と接点、VDF→HFP→VDFの番号。Fを削除しない。CF₃ shell/二つのfluorinated source混同で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `vinylidene-fluoride → hexafluoropropylene → vinylidene-fluoride`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: S15。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ CF3側接続と主鎖、H/Fのsource差を元素色とは別の由来凡例で確認。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R23`と該当A/V/S15、未実施はNOT_RUN。
- 禁止/限界: U0; 全体組成比、random/block、regioregularityやstereo分布。

### R24. `polytetrafluoroethylene`

- Route ID: `polytetrafluoroethylene-radical`。主/副目標: E2 / E1。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: Fに囲まれたC主鎖とC–F置換結合。
- fixture targets: inter-source heavy bond indices=`[3,11,14]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 全C/F/全C–F、C backbone連続性を回転/局所で回復、helix/結晶表示禁止。F shellによるC主鎖遮蔽/helix誤断定で必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `tetrafluoroethylene → tetrafluoroethylene → tetrafluoroethylene → tetrafluoroethylene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- source/反応UI: 主段階はafter、source snapshotは必要な別段階だけ。元素fillの変更は禁止。
- Screenshot/state: S11。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 全てのF原子とC主鎖を保持し、H原子を含まない実元素構成を守る。遮蔽をatom削除で解決せず回転/拡大で到達。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R24`と該当A/V/S11、未実施はNOT_RUN。
- 禁止/限界: U0; 特定helix/結晶充填、摩擦や耐熱性の直接測定。

### R25. `nylon-6-6`

- Route ID: `nylon-6-6-direct-polycondensation`。主/副目標: E3 / E2,E4。教育分類・V根拠: Task②同IDの詳細行（再設計なし）。
- 実観察対象: acid/hexamethylenediamine残基間C(=O)–Nと別水。
- fixture targets: inter-source heavy bond indices=`[1,7,53]`; carbonyl C=O bond indices=`[2,38,52,54]`。全次数集合はJSON `selector.orders`（indexはgraph.bondsの配列位置）。追加の正本selectorはJSON `backboneAtoms/backboneBonds/sideAttachment`（chainのみ、source非芳香C=C/epoxide原子のfinal origin対応）、`ringBonds/ester/amide/etherO/acidOH/methyleneBridge/hydroxymethyl`。各役割名は実接続の検査で、主鎖分岐や機構の追加ではない。methyl候補には構造上のCH3を列挙し、主鎖/側基の役割はsource site対応でさらに判定する。
- 画面に必要な関係/失敗条件: 初期両端と全体、局所amide3とN–H、3water、六Cdiamine由来span。ports0保持。最長79atom片/小さいamide/端切れで必要集合がA07の有限操作で回復不能ならFAIL。初期I、局所L、resetで再現。全mesh boundはA01、全atom識別はA03/A07、全orderはA04。
- 強調の根拠: `fragment.atomOrigins`/実edge/source role。JSON `selector.sourceAtoms`は由来であり残基の完結境界ではない。由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → hexamethylenediamine → adipic-acid → hexamethylenediamine`、投入元4個、water 3個。実C(=O)–N連結と別partitionの水。
- source/反応UI: V6の実source/after/byproduct状態を必須。V5の原料番号/破線/名称を必須。元素fillの変更は禁止。
- Screenshot/state: C05 / S13。tableのrequired states、全3viewport×2motion、A07到達quaternion/selection/zoomをsidecar保存。初期視覚と局所視覚を混ぜて全体fitの証拠にしない。
- 実装分担: ④ 三amide/三water/ports0、六Cのdiamine由来spanとcarbonyl–NH、長い実有限片の全体fitと局所識別。共通のgraph/atom origin不変量とV0を必須とする。 ⑤はspecのmesh/order/fit/凡例/比較/gestureを実装。⑥`T3-R25`と該当A/V/C05 / S13、未実施はNOT_RUN。
- 禁止/限界: U0; 4完全repeat、結晶性や強度を有限片から確定。

## Representative cases C01–C09

各Caseは教育正本C01–C09の対象/観察質問をそのまま採用し、下表は技術的な画面準備/可視性の判定。全case: fixtureは同polymer JSON行、targetは上のR行、初期I/neutral→必要操作→reset、全3viewport×2motion、代表DPR2、source sidecar必須。撮影は静止ready後、font-ready、同一state/pose、raster readbackを性能window外に置く。

| Case / fixture | 必須target set・期待画面 | 操作・強調状態 / 失敗判定 | Screenshot / ④⑤要求 |
|---|---|---|---|
| C01 / R01 PE | 主鎖C両端、連続C–C全edge、H側路を保持。端を同初期画角に | 初期neutral、O/Z/F可。採点前path強調は禁止。近接Hへ架空接続、両端欠落、path回復不能FAIL | neutral/両端/reset、V6副段階before/after。④path sets、⑤I/L・端注記 |
| C02 / R02 PP | 一methyl C/H3と接点、隣接主鎖経路を1local view | O/Z/F、技術撮影はpath/side/接点を別label。回答位置を先に示せばH2。methylをpolymer armと表示FAIL | neutral/local-connect/reset。④role mapping、⑤V1 |
| C03 / R05 PS | 一側環6C/6edge＋付着1＋隣接主鎖、全4環coverage | Oで環面/裏edge、Z/F、選択輪郭はring全体。ring半分/別環合成/側環を主鎖環表示FAIL | neutral/ring-face/ring-attach、④ring geometry、⑤V1/V2/V3 |
| C04 / R11 PET | acid/glycol origin両側を持つ一C(=O)–O、実water一分子。副段階二主鎖環 | before→after→byproduct、原料①②＋local。waterと主鎖同tuple二重計上、元分子が無変化で残る表示FAIL | before/after/ester-local/water/source、④partition/ester/環、⑤V4/V5/V6 |
| C05 / R25 Nylon-6,6 | 一C(=O)–N/N–H、酸/六Cdiamine由来の両側、実water。長片全79atom | Iで全体→Fでamide、source①②/waterを別state。PE-adipamide二Cdiamineと混同/端切れ/水とN同定不能FAIL | overview/amide-local/before/after/water/source。④長片geometry、⑤V3–V6/fit |
| C06 / R10 PEO | 元ethylene-oxideのC–C–O三員閉路と、同tupleがつなぐ最終開いた主鎖経路。後μ0 | before↔after、O/Z/F、broken edgeはafterに重ねない。ghost環/水生成/元環のtuple対応なしFAIL | before-ring/after-open/local。④ring-opening対応、⑤V4/V6 |
| C07 / R08 PAN | 一CN3lane/2gapと同画面の主鎖single、全4CNを追加coverage | 中立1/2/3凡例、O/Z/F、選択次数文字併用。2lane/太線/3原子解説FAIL。L1解消前は試験未準備 | overview/CN-local各target/order-legend。④CN角、⑤order3実装 |
| C08 / R18 SBR | BD→styrene→BD origin、styrene側環、BD残存C=C2。ring内order2とは別 | source状態→local環/鎖、①②とname、fill元素維持。bulk2:1/random/block/加硫junction断定FAIL | overview/source/ring-local/diene-local、④集合/geometry、⑤V2/V3/V5/V7 |
| C09 / R15 PF | actual二環/両環間CH2/CH2OH、独立4環/3bridge networkを別題/別identity | actual↔concept-separate、O/Z/F、L2保護者注記。actualにthird-arm/四環/ortho-para正解注釈FAIL | actual/bridge-local/concept-separate/water、④実graph、⑤V8 UI。化学妥当性自体は留保 |

## Additional stress acceptance

| ID | 実graphの特徴 | 追加PASS/FAIL / state |
|---|---|---|
| S10 NBR / R19 | order1/2/3、CN1、鎖C=C2 | 一つの局所viewでCNとC=Cの線本数を比較、必要ならsource-neutral二local panelを切替。全3本を同時数えられず次数を文字だけに頼ればFAIL。A04全edgeは必須 |
| S11 PTFE / R24 | F shell、8C/16F | 全Cと全C–F edgeのA07 coverage、Fを非表示/透明にして合格不可。主鎖をたどる連続path witnessを保存 |
| S12 PIB / R04 | 同一Cにつく2methyl、全H | 同接点・2methyl C・各H3・主鎖通過を同local witnessに。2つが1つに見え分離操作不能FAIL |
| S13 Nylon / R25 | 79atom、3amide、長い六Cdiamine | 初期全範囲と実末端、全amide可視性、resize/reopen、local後reset。H≥4px/他≥6px、A07/A12 |
| S14 PCTFE / R07 | C/F/Cl、Hなし | F/Cl文字凡例/選択symbol、C–FとC–Clを同local、色だけの識別FAIL |
| S15 VDF–HFP / R23 | 中央sourceのCF3、二種F原料 | CF3のC/F3/接点と隣接主鎖を同local、①②は原料名、fillをsource色に置換FAIL |
| S16 PAA/PLA / R09/R13 | 酸OHとester、PLA methyl | 酸O–H/C=Oとester C(=O)–Oを別routeの実stateとして比較、OH実Hを消して区別不能にしない。PLA methyl接合もA07 |

## Verification and boundaries

全25のrow/詳細/ID組/主副E/Task②V集合、全C/S IDとtarget配列range、graph digest/原子・結合数/次数/ring/source集合はevidenceの再現checkで照合する。現在のraster/gesture/児童/完成renderer PASSを表の存在から推論しない。全未実装stateは⑤、全実画面/児童/性能受入は⑥。PF L2は独立した化学評価課題であり、外観文書のCLOSEDで消えない。
