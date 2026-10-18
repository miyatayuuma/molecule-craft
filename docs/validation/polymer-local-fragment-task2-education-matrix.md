# All-25 routes — Task② educational matrix

Normative companion: [Task② educational authority](polymer-local-fragment-task2-education.md)。化学的入力は [Task① route matrix](polymer-local-fragment-route-matrix.md) と [Task① authority](polymer-local-fragment-task1-authority.md)。source baselineは `96a7ec72643eddd140cedeb311c45c36bd07202a`。Task①の実Core監査を採用し、旧構想の再調査や新しい高分子グラフの生成は行わない。

## Reading and shared contracts

全25行の識別・目標・分類と、続く25詳細ブロックを一体で使用する。各詳細ブロックは依頼の13項目を、ID/route、主副目標、分類、実構造、探す対象、最低説明、誤解、禁止断定、③視覚、④/⑤検証、sourceとして固定する。evidenceは4クラスに分ける。V0–V8/E1–E4/U0/M1–M9は教育正本の定義を参照し、各行に一律U0を適用する。

数値U/μ/O/W/Pは投入分子インスタンス数/実cycle rank/実結合次数集合/分離water数/実continuations数。Xはfinal graphの異なるsource instance origin間を結ぶ実edge数、Lは実growth/link commit step数。Xはorigin partition由来の数で、鎖junction数ではない。PFはX=4/L=3（移動Hの由来跨ぎedgeを含む）、他routeはX=L=U−1。UはCRU数ではない。OBSERVED_GRAPHは最終fragmentだけ、REACTION_EVIDENCEは前後/履歴比較、ILLUSTRATIVE_CONCEPTは別枠概念、UNCERTAIN_OR_UNSUPPORTEDは断定禁止。側基は三方向高分子鎖junctionを意味しない。全25でそのjunctionは未確認。

OBSERVED_GRAPH中の原料名や由来列は最終原子のsource originを示し、元分子全体が無変化で残ることや、反応前後を完成模型だけから直接観測できることを意味しない。

現行のviewには本仕様が求める全注釈・比較導線・次数区別が完成していない。各行の「③」「④/⑤」は将来の実装/受入要件であり、現在の機能PASSではない。色・半径・camera数値は後工程所有。

## Inventory

| Polymer ID | Route ID | 主 | 副 | 複数軸の表示分類 | builder / transform families | U | μ | O | W | P | X | L |
|---|---|---|---|---|---|---:|---:|---|---:|---:|---:|---:|
| `polyethylene` | `polyethylene-coordination` | E1 | E3 | C-SAT | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `polypropylene` | `polypropylene-coordination` | E2 | E1 | C-SAT SIDE-METHYL | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `ethylene-propylene-copolymer` | `ethylene-propylene-coordination` | E4 | E2 | C-SAT SIDE-METHYL MIXED-LOCAL | chain / vinyl | 3 | 0 | 1 | 0 | 2 | 2 | 2 |
| `polyisobutylene` | `polyisobutylene-cationic` | E2 | E1 | C-SAT SIDE-METHYL | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `polystyrene` | `polystyrene-radical` | E2 | E1 | C-SAT RING-PENDANT BOND-2 | chain / vinyl | 4 | 4 | 1,2 | 0 | 2 | 3 | 3 |
| `polyvinyl-chloride` | `polyvinyl-chloride-radical` | E2 | E1 | C-SAT SIDE-HALOGEN | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `polychlorotrifluoroethylene` | `polychlorotrifluoroethylene-radical` | E2 | E1 | C-SAT SIDE-HALOGEN | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `polyacrylonitrile` | `polyacrylonitrile-radical` | E2 | E1 | C-SAT SIDE-NITRILE BOND-3 | chain / vinyl | 4 | 0 | 1,3 | 0 | 2 | 3 | 3 |
| `polyacrylic-acid` | `polyacrylic-acid-radical` | E2 | E1 | C-SAT SIDE-ACID BOND-2 | chain / vinyl | 4 | 0 | 1,2 | 0 | 2 | 3 | 3 |
| `polyethylene-oxide` | `polyethylene-oxide-anionic-ring-opening` | E3 | E2 | HET-ETHER ETHER | chain / epoxide | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `polyethylene-terephthalate` | `polyethylene-terephthalate-direct-polycondensation` | E3 | E2,E4 | HET-ESTER ESTER BOND-2 RING-BACKBONE TWO-SOURCE-COND | step-growth / ester-condensation | 4 | 2 | 1,2 | 3 | 0 | 3 | 3 |
| `polyethylene-adipate` | `polyethylene-adipate-direct-polycondensation` | E3 | E2 | HET-ESTER ESTER BOND-2 TWO-SOURCE-COND | step-growth / ester-condensation | 4 | 0 | 1,2 | 3 | 0 | 3 | 3 |
| `polylactic-acid` | `polylactic-acid-direct-polycondensation` | E3 | E2 | HET-ESTER ESTER BOND-2 SIDE-METHYL SELF-COND | step-growth / ester-condensation | 4 | 0 | 1,2 | 3 | 0 | 3 | 3 |
| `polyglycolic-acid` | `polyglycolic-acid-direct-polycondensation` | E3 | E2 | HET-ESTER ESTER BOND-2 SELF-COND | step-growth / ester-condensation | 4 | 0 | 1,2 | 3 | 0 | 3 | 3 |
| `phenol-formaldehyde-resin` | `phenol-formaldehyde-resole` | E4 | E2,E3 | PF-FINITE RING-PF BOND-2 HYDROXYMETHYL NETWORK-CAPABILITY | network / phenol-methylolation, phenol-methylene-bridge | 4 | 2 | 1,2 | 1 | 0 | 4 | 3 |
| `polyethylene-adipamide` | `polyethylene-adipamide-direct-polycondensation` | E3 | E2 | HET-AMIDE AMIDE BOND-2 TWO-SOURCE-COND | step-growth / amide-condensation | 4 | 0 | 1,2 | 3 | 0 | 3 | 3 |
| `polybutadiene` | `polybutadiene-coordination-1-4` | E3 | E2 | C-UNSAT BOND-2 | chain / diene | 4 | 0 | 1,2 | 0 | 2 | 3 | 3 |
| `styrene-butadiene-copolymer` | `styrene-butadiene-radical` | E4 | E2,E3 | C-UNSAT BOND-2 RING-PENDANT MIXED-LOCAL | chain / vinyl, diene | 3 | 1 | 1,2 | 0 | 2 | 2 | 2 |
| `nitrile-butadiene-rubber` | `nitrile-butadiene-radical` | E4 | E2,E3 | C-UNSAT BOND-2 SIDE-NITRILE BOND-3 MIXED-LOCAL | chain / vinyl, diene | 3 | 0 | 1,2,3 | 0 | 2 | 2 | 2 |
| `polyisoprene` | `polyisoprene-coordination-1-4` | E3 | E2 | C-UNSAT SIDE-METHYL BOND-2 | chain / diene | 4 | 0 | 1,2 | 0 | 2 | 3 | 3 |
| `butyl-rubber` | `butyl-rubber-cationic` | E4 | E2 | C-UNSAT SIDE-METHYL BOND-2 MIXED-LOCAL | chain / vinyl, diene | 3 | 0 | 1,2 | 0 | 2 | 2 | 2 |
| `polyvinylidene-fluoride` | `polyvinylidene-fluoride-radical` | E2 | E1 | C-SAT SIDE-HALOGEN | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `vinylidene-fluoride-hexafluoropropylene-copolymer` | `vinylidene-fluoride-hexafluoropropylene-radical` | E4 | E2 | C-SAT SIDE-HALOGEN SIDE-CF3 MIXED-LOCAL | chain / vinyl | 3 | 0 | 1 | 0 | 2 | 2 | 2 |
| `polytetrafluoroethylene` | `polytetrafluoroethylene-radical` | E2 | E1 | C-SAT SIDE-HALOGEN | chain / vinyl | 4 | 0 | 1 | 0 | 2 | 3 | 3 |
| `nylon-6-6` | `nylon-6-6-direct-polycondensation` | E3 | E2,E4 | HET-AMIDE AMIDE BOND-2 TWO-SOURCE-COND | step-growth / amide-condensation | 4 | 0 | 1,2 | 3 | 0 | 3 | 3 |

## Route-specific educational contracts

### 01. `polyethylene`

- Polymer ID: `polyethylene`
- Route ID: `polyethylene-coordination`
- 主学習目標: E1
- 副学習目標: E3
- 教育的表示分類: C-SAT; reaction=`chain; vinyl`
- OBSERVED_GRAPH: ethene×4; saturated C backbone, no heavy-atom side group; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `ethene → ethene → ethene → ethene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 実C–C主鎖を両端の間でたどる。近接するだけのHへ飛び移らない。
- 最低限の説明: 「原子は棒でつながっています。つながりを端から端までたどってみよう。」
- 起こりやすい誤解: 4原料を完全repeat4個と一般化／近くの球は全て結合。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; この短片が全高分子／完全にH終端した安定鎖。
- Task③ 視覚的強調: V0 V6。焦点は「実C–C主鎖を両端の間でたどる。近接するだけのHへ飛び移らない」。副目標は別段階。
- Task④/⑤ 表示検証: 全主鎖edgeの連続性と実端、元etheneのC=C変化と生成後のsingle bondを区別。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L229](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L229); Task① matrixの`polyethylene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 02. `polypropylene`

- Polymer ID: `polypropylene`
- Route ID: `polypropylene-coordination`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-METHYL; reaction=`chain; vinyl`
- OBSERVED_GRAPH: propene×4; saturated backbone, methyl substituents; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `propene → propene → propene → propene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 二原料接続を結ぶC主鎖から出るCH3とその一接続点。
- 最低限の説明: 「鎖をたどる道と、そこから出ている小さなまとまりを見つけよう。」
- 起こりやすい誤解: メチルを別の高分子鎖／画面の横方向を側鎖定義とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; isotactic/syndiotactic/atacticの確定、三方向鎖分岐。
- Task③ 視覚的強調: V0 V1。焦点は「二原料接続を結ぶC主鎖から出るCH3とその一接続点」。副目標は別段階。
- Task④/⑤ 表示検証: 主鎖Cとmethyl Cの役割対応、隠れたHを含む全表示、回転後も接続点が区別可能。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L277](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L277); Task① matrixの`polypropylene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 03. `ethylene-propylene-copolymer`

- Polymer ID: `ethylene-propylene-copolymer`
- Route ID: `ethylene-propylene-coordination`
- 主学習目標: E4
- 副学習目標: E2
- 教育的表示分類: C-SAT SIDE-METHYL MIXED-LOCAL; reaction=`chain; vinyl`
- OBSERVED_GRAPH: ethene→propene→ethene; one methyl-bearing source unit; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `ethene → propene → ethene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 異種原料を組み合わせる共重合体の考え方。実局所列をbulk比率・配列統計と区別。
- 子どもが探す対象: ethene→propene→etheneの実局所列と中央由来のメチル。
- 最低限の説明: 「この短い例には2種類の原料から来た部分があります。形の違う部分を探そう。」
- 起こりやすい誤解: 3投入の2:1を実材料全体の組成比とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; bulk比率2:1、random/block/alternating分布。
- Task③ 視覚的強調: V0 V1 V5。焦点は「ethene→propene→etheneの実局所列と中央由来のメチル」。副目標は別段階。
- Task④/⑤ 表示検証: 由来tupleによる二種識別、メチルと主鎖、局所列と全体未知の注釈分離。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L327](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L327); Task① matrixの`ethylene-propylene-copolymer`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 04. `polyisobutylene`

- Polymer ID: `polyisobutylene`
- Route ID: `polyisobutylene-cationic`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-METHYL; reaction=`chain; vinyl`
- OBSERVED_GRAPH: isobutene×4; two methyl substituents on substituted backbone C; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `isobutene → isobutene → isobutene → isobutene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 同じ置換主鎖Cから出る二つのメチル。高分子鎖の腕とは区別。
- 最低限の説明: 「同じ鎖のところから、小さなまとまりが二つ出ています。」
- 起こりやすい誤解: Cのdegreeだけからbranched polymerと判定。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 三本の高分子鎖が結んだjunction／固有のtacticity。
- Task③ 視覚的強調: V0 V1。焦点は「同じ置換主鎖Cから出る二つのメチル。高分子鎖の腕とは区別」。副目標は別段階。
- Task④/⑤ 表示検証: geminal methyl二個の接続点と主鎖通過経路、H混雑を削除なしで解決。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L378](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L378); Task① matrixの`polyisobutylene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 05. `polystyrene`

- Polymer ID: `polystyrene`
- Route ID: `polystyrene-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT RING-PENDANT BOND-2; reaction=`chain; vinyl`
- OBSERVED_GRAPH: styrene×4; four pendant six-C rings with alternating orders 1/2; μ=4, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `styrene → styrene → styrene → styrene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 主鎖から一つの結合でぶら下がる六C環を一周。
- 最低限の説明: 「鎖から出ている輪を探そう。輪の結合をたどると元へ戻れます。」
- 起こりやすい誤解: 芳香環を主鎖全体の輪／環の二重結合を残存vinylとする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 環状高分子／特定tacticity／結合交替から固定した電子状態。
- Task③ 視覚的強調: V0 V1 V2 V3。焦点は「主鎖から一つの結合でぶら下がる六C環を一周」。副目標は別段階。
- Task④/⑤ 表示検証: 四つの実環の閉路、側環の一付着とC主鎖を保持、ring平面/重なりと結合次数を確認。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L431](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L431); Task① matrixの`polystyrene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 06. `polyvinyl-chloride`

- Polymer ID: `polyvinyl-chloride`
- Route ID: `polyvinyl-chloride-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-HALOGEN; reaction=`chain; vinyl`
- OBSERVED_GRAPH: vinyl-chloride×4; Cl on saturated backbone; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `vinyl-chloride → vinyl-chloride → vinyl-chloride → vinyl-chloride`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: C主鎖に共有結合したClを凡例と結合で識別。
- 最低限の説明: 「鎖にくっついている塩素の原子を、印とつながりで探そう。」
- 起こりやすい誤解: Clを遊離塩素／主鎖そのものとする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 材料の有害性・強度等をこの有限模型から測定したとの断定。
- Task③ 視覚的強調: V0 V1。焦点は「C主鎖に共有結合したClを凡例と結合で識別」。副目標は別段階。
- Task④/⑤ 表示検証: 元素Clと主鎖Cの非色覚凡例、全Cl/Hを保持、結合が重なりで消えない。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L481](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L481); Task① matrixの`polyvinyl-chloride`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 07. `polychlorotrifluoroethylene`

- Polymer ID: `polychlorotrifluoroethylene`
- Route ID: `polychlorotrifluoroethylene-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-HALOGEN; reaction=`chain; vinyl`
- OBSERVED_GRAPH: chlorotrifluoroethylene×4; source-mapped F/Cl on C backbone; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `chlorotrifluoroethylene → chlorotrifluoroethylene → chlorotrifluoroethylene → chlorotrifluoroethylene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: FとClの置換基をC主鎖との結合で対比。
- 最低限の説明: 「鎖についている2種類の原子を、印とつながりで見分けよう。」
- 起こりやすい誤解: F/Clを色だけで見分けたつもりになる／別鎖とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; tacticity／一様なbulk配置や結晶。
- Task③ 視覚的強調: V0 V1。焦点は「FとClの置換基をC主鎖との結合で対比」。副目標は別段階。
- Task④/⑤ 表示検証: F/Clの元素凡例を別にし、C主鎖と各原子のedgeを回転後も確認。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L531](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L531); Task① matrixの`polychlorotrifluoroethylene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 08. `polyacrylonitrile`

- Polymer ID: `polyacrylonitrile`
- Route ID: `polyacrylonitrile-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-NITRILE BOND-3; reaction=`chain; vinyl`
- OBSERVED_GRAPH: acrylonitrile×4; four pendant C≡N groups, order 3; μ=0, orders=1,3。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `acrylonitrile → acrylonitrile → acrylonitrile → acrylonitrile`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 側基C≡Nの実order3と主鎖single bond。
- 最低限の説明: 「この部分の炭素と窒素は三重結合です。鎖の一本の結合と見比べよう。」
- 起こりやすい誤解: 現2laneを化学的二重結合と解釈／線3本=原子3個。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; order3をorder2と説明／炭素繊維の実物がこの構造だと断定。
- Task③ 視覚的強調: V0 V1 V3。焦点は「側基C≡Nの実order3と主鎖single bond」。副目標は別段階。
- Task④/⑤ 表示検証: 四C≡Nの次数3・local長さ/直線性を検証。L1:現rendererは2lane、⑤修正まで次数視覚受入未達。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L581](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L581); Task① matrixの`polyacrylonitrile`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 09. `polyacrylic-acid`

- Polymer ID: `polyacrylic-acid`
- Route ID: `polyacrylic-acid-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-ACID BOND-2; reaction=`chain; vinyl`
- OBSERVED_GRAPH: acrylic-acid×4; pendant C(=O)OH groups, acid O–H present; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `acrylic-acid → acrylic-acid → acrylic-acid → acrylic-acid`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 側基C(=O)OHと主鎖C経路。酸Hは実際に残る。
- 最低限の説明: 「鎖から出た部分に、酸素が二つあるまとまりを探そう。」
- 起こりやすい誤解: 全Oを水／酸基Cを主鎖へ数え込む。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 酸解離・pH・材料性状をこのneutral実グラフだけで確定。
- Task③ 視覚的強調: V0 V1 V3 V4。焦点は「側基C(=O)OHと主鎖C経路。酸Hは実際に残る」。副目標は別段階。
- Task④/⑤ 表示検証: carboxylのC=OとC–OH、保持されたHと主鎖の側接続を区別。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L631](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L631); Task① matrixの`polyacrylic-acid`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 10. `polyethylene-oxide`

- Polymer ID: `polyethylene-oxide`
- Route ID: `polyethylene-oxide-anionic-ring-opening`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: HET-ETHER ETHER; reaction=`chain; epoxide`
- OBSERVED_GRAPH: four source-origin groups; C–C–O backbone paths with ether O; no graph cycle; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `ethylene-oxide → ethylene-oxide → ethylene-oxide → ethylene-oxide`、投入元4個、water 0個。元のepoxide閉路が開き、実ringOpenings=4。最終graphに環はない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 元ethylene-oxide三員環と、生成後の環なしC–O–C主鎖。
- 最低限の説明: 「原料の小さな輪が開き、酸素も入った鎖になりました。元と今を見比べよう。」
- 起こりやすい誤解: 完成PEOにも輪がある／開環でOが水になる。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 完成片が環状／全etherが同じ開環過程を経るとの一般化。
- Task③ 視覚的強調: V0 V4 V6。焦点は「元ethylene-oxide三員環と、生成後の環なしC–O–C主鎖」。副目標は別段階。
- Task④/⑤ 表示検証: 実ringOpenings4、cycle0、water0。実source状態と生成後を別提示、全ether Oを主鎖内に保持。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L681](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L681); Task① matrixの`polyethylene-oxide`行; Task① S2/S3（epoxideの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 11. `polyethylene-terephthalate`

- Polymer ID: `polyethylene-terephthalate`
- Route ID: `polyethylene-terephthalate-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2,E4
- 教育的表示分類: HET-ESTER ESTER BOND-2 RING-BACKBONE TWO-SOURCE-COND; reaction=`step-growth; ester-condensation`
- OBSERVED_GRAPH: terephthalic-acid→ethylene-glycol→terephthalic-acid→ethylene-glycol; two backbone rings, three ester links; μ=2, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `terephthalic-acid → ethylene-glycol → terephthalic-acid → ethylene-glycol`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 酸由来＋glycol/diamine由来残基を組にするCRUの考え方。実端を含む4投入を完全CRU数へ置換しない。
- 子どもが探す対象: 酸由来の環を通る連続性、glycol由来O、実esterと別の水。
- 最低限の説明: 主E3:「2種類の原料の一部が鎖につながり、一部は水になりました。」副E2の別段階:「輪は鎖の途中にあります。」
- 起こりやすい誤解: 4投入=4repeat／全Oは水／環をPS同様の側環とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 完全repeat数4または末端無視の2／完成片が閉じた環状全分子。
- Task③ 視覚的強調: V0 V2 V3 V4 V5 V6。焦点は「酸由来の環を通る連続性、glycol由来O、実esterと別の水」。副目標は別段階。
- Task④/⑤ 表示検証: 二主鎖芳香環・三ester・三water・実端基/ports0、酸/glycol残基とCRU概念を分離。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L732](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L732); Task① matrixの`polyethylene-terephthalate`行; Task① S2/S3（ester-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 12. `polyethylene-adipate`

- Polymer ID: `polyethylene-adipate`
- Route ID: `polyethylene-adipate-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: HET-ESTER ESTER BOND-2 TWO-SOURCE-COND; reaction=`step-growth; ester-condensation`
- OBSERVED_GRAPH: adipic-acid→ethylene-glycol→adipic-acid→ethylene-glycol; three ester links; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → ethylene-glycol → adipic-acid → ethylene-glycol`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 酸由来＋glycol/diamine由来残基を組にするCRUの考え方。実端を含む4投入を完全CRU数へ置換しない。
- 子どもが探す対象: adipic-acidとglycol残基を結ぶC(=O)–O、実端基と水。
- 最低限の説明: 「2種類の原料から鎖ができ、一部の原子は水になって分かれました。」
- 起こりやすい誤解: 酸分子がそのまま全原子で残る／原料数=repeat数。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 4完全repeat／生成後Oが全て水／未表示端の追加結合。
- Task③ 視覚的強調: V0 V3 V4 V5 V6。焦点は「adipic-acidとglycol残基を結ぶC(=O)–O、実端基と水」。副目標は別段階。
- Task④/⑤ 表示検証: 三ester/三water/ports0。柔軟spanの主鎖経路と端のacid/alcoholの区別。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L786](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L786); Task① matrixの`polyethylene-adipate`行; Task① S2/S3（ester-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 13. `polylactic-acid`

- Polymer ID: `polylactic-acid`
- Route ID: `polylactic-acid-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: HET-ESTER ESTER BOND-2 SIDE-METHYL SELF-COND; reaction=`step-growth; ester-condensation`
- OBSERVED_GRAPH: lactic-acid×4; three ester links and methyl side groups; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `lactic-acid → lactic-acid → lactic-acid → lactic-acid`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 同じlactic-acid由来の残基間ester、水、横のメチル。
- 最低限の説明: 主E3:「同じ種類の原料がつながり、一部の原子は水になりました。」副E2の別段階:「横の小さなまとまりも探そう。」
- 起こりやすい誤解: 必ず二種原料がないと縮合不能／メチル=鎖分岐。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 特定L/D配列やtacticity、完全repeatの無条件数え上げ。
- Task③ 視覚的強調: V0 V1 V3 V4 V6。焦点は「同じlactic-acid由来の残基間ester、水、横のメチル」。副目標は別段階。
- Task④/⑤ 表示検証: 三ester/三water、methyl側基とactual end groups。chiral配列をgeometryで確定しない。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L839](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L839); Task① matrixの`polylactic-acid`行; Task① S2/S3（ester-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 14. `polyglycolic-acid`

- Polymer ID: `polyglycolic-acid`
- Route ID: `polyglycolic-acid-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: HET-ESTER ESTER BOND-2 SELF-COND; reaction=`step-growth; ester-condensation`
- OBSERVED_GRAPH: glycolic-acid×4; three ester links; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `glycolic-acid → glycolic-acid → glycolic-acid → glycolic-acid`、投入元4個、water 3個。実C(=O)–O連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 同種glycolic-acid由来のesterと別分離した水。
- 最低限の説明: 「同じ種類の原料がつながり、一部の原子は水になって分かれました。」
- 起こりやすい誤解: Oは全部水／全縮合が二種原料。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 末端を消した無限鎖／この模型から分解速度を確定。
- Task③ 視覚的強調: V0 V3 V4 V6。焦点は「同種glycolic-acid由来のesterと別分離した水」。副目標は別段階。
- Task④/⑤ 表示検証: 三ester/三water/ports0、carbonylと単結合O、酸/alcohol末端を保持。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L893](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L893); Task① matrixの`polyglycolic-acid`行; Task① S2/S3（ester-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 15. `phenol-formaldehyde-resin`

- Polymer ID: `phenol-formaldehyde-resin`
- Route ID: `phenol-formaldehyde-resole`
- 主学習目標: E4
- 副学習目標: E2,E3
- 教育的表示分類: PF-FINITE RING-PF BOND-2 HYDROXYMETHYL NETWORK-CAPABILITY; reaction=`network; phenol-methylolation, phenol-methylene-bridge`
- OBSERVED_GRAPH: phenol→formaldehyde→phenol→formaldehyde; two rings, one methylene bridge and hydroxymethyl site; no three-arm junction; μ=2, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=4、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `phenol → formaldehyde → phenol → formaldehyde`、投入元4個、water 1個。実hydroxymethyl site形成（位置妥当性L2は未評価）。二環間の実methylene bridgeと水。
- ILLUSTRATIVE_CONCEPT: 一般的network形成能力と独立図鑑4環/3bridge motifは実2環Sampleとは別の模式説明。L2を解決した図ではない。
- 子どもが探す対象: 実二環をつなぐCH2とCH2OH、別図のnetworkとの相違。
- 最低限の説明: 「今回の短い模型には輪が二つあります。網目の図は、別にしくみを説明する図です。」
- 起こりやすい誤解: network builderだから実三分岐／図鑑4環と同一Sample／origin degree=分岐。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; この実サンプルに三方向junction/鎖間架橋／標準ortho/para位置選択を検証済み。
- Task③ 視覚的強調: V0 V2 V4 V6 V8。焦点は「実二環をつなぐCH2とCH2OH、別図のnetworkとの相違」。副目標は別段階。
- Task④/⑤ 表示検証: 実二環/一methylene bridge/hydroxymethyl/一water/ports0、origin移動H、L2化学評価留保、独立SVGを別identity。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L945](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L945); Task① matrixの`phenol-formaldehyde-resin`行; Task① S2/S3（phenol-methylolation, phenol-methylene-bridgeの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 16. `polyethylene-adipamide`

- Polymer ID: `polyethylene-adipamide`
- Route ID: `polyethylene-adipamide-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: HET-AMIDE AMIDE BOND-2 TWO-SOURCE-COND; reaction=`step-growth; amide-condensation`
- OBSERVED_GRAPH: adipic-acid→ethylenediamine→adipic-acid→ethylenediamine; three amide links; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → ethylenediamine → adipic-acid → ethylenediamine`、投入元4個、water 3個。実C(=O)–N連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 酸由来＋glycol/diamine由来残基を組にするCRUの考え方。実端を含む4投入を完全CRU数へ置換しない。
- 子どもが探す対象: adipic-acidとethylenediamine由来を結ぶC(=O)–Nと実water。
- 最低限の説明: 「2種類の原料から鎖ができ、一部は水になりました。窒素も鎖の途中にあります。」
- 起こりやすい誤解: amideをesterと同一元素接続とする／nylon66のdiamineと同一視。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 4完全repeat／diamine鎖長をnylon66と同じと説明。
- Task③ 視覚的強調: V0 V3 V4 V5 V6。焦点は「adipic-acidとethylenediamine由来を結ぶC(=O)–Nと実water」。副目標は別段階。
- Task④/⑤ 表示検証: 三amide/三water/ports0、carbonyl–NとN–H、二Cのdiamine由来spanを保持。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1004](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1004); Task① matrixの`polyethylene-adipamide`行; Task① S2/S3（amide-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 17. `polybutadiene`

- Polymer ID: `polybutadiene`
- Route ID: `polybutadiene-coordination-1-4`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: C-UNSAT BOND-2; reaction=`chain; diene`
- OBSERVED_GRAPH: four source-origin groups; C backbone with four C=C bonds; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → 1-3-butadiene → 1-3-butadiene → 1-3-butadiene`、投入元4個、water 0個。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 元dieneの二C=Cと、1,4編集後に各原料由来に残るC=C。
- 最低限の説明: 「つながり方が変わったあとにも、二重結合が残っています。」
- 起こりやすい誤解: 重合なら全二重結合が消える／曲がりをcis/trans統計とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 全材料のcis/trans・1,4/1,2比、unique conformer。
- Task③ 視覚的強調: V0 V3 V6 V7。焦点は「元dieneの二C=Cと、1,4編集後に各原料由来に残るC=C」。副目標は別段階。
- Task④/⑤ 表示検証: 四残存C=Cと実inter-unit single bonds、元dieneとの差分を保持。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1057](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1057); Task① matrixの`polybutadiene`行; Task① S2/S3（dieneの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 18. `styrene-butadiene-copolymer`

- Polymer ID: `styrene-butadiene-copolymer`
- Route ID: `styrene-butadiene-radical`
- 主学習目標: E4
- 副学習目標: E2,E3
- 教育的表示分類: C-UNSAT BOND-2 RING-PENDANT MIXED-LOCAL; reaction=`chain; vinyl, diene`
- OBSERVED_GRAPH: BD/styrene/BD source-origin groups; one pendant aromatic ring and two backbone C=C bonds; μ=1, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → styrene → 1-3-butadiene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- ILLUSTRATIVE_CONCEPT: 異種原料を組み合わせる共重合体の考え方。実局所列をbulk比率・配列統計と区別。
- 子どもが探す対象: BD→styrene→BDの実由来列、側芳香環と鎖内残存C=C。
- 最低限の説明: 「2種類の原料から来た部分があります。輪のある部分と、鎖に残った二重結合を探そう。」
- 起こりやすい誤解: 3入力からbulk2:1／側環C=Cと鎖内C=Cを混同。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; random/block、全体比率、cis/trans分布、加硫済み架橋。
- Task③ 視覚的強調: V0 V1 V2 V3 V5 V7。焦点は「BD→styrene→BDの実由来列、側芳香環と鎖内残存C=C」。副目標は別段階。
- Task④/⑤ 表示検証: 一側環と二残存C=C、二種originsを別確認。芳香環order2をdiene残存数へ含めない。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1109](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1109); Task① matrixの`styrene-butadiene-copolymer`行; Task① S2/S3（vinyl, dieneの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 19. `nitrile-butadiene-rubber`

- Polymer ID: `nitrile-butadiene-rubber`
- Route ID: `nitrile-butadiene-radical`
- 主学習目標: E4
- 副学習目標: E2,E3
- 教育的表示分類: C-UNSAT BOND-2 SIDE-NITRILE BOND-3 MIXED-LOCAL; reaction=`chain; vinyl, diene`
- OBSERVED_GRAPH: BD/acrylonitrile/BD source-origin groups; one C≡N side group and two backbone C=C bonds; μ=0, orders=1,2,3。
- REACTION_EVIDENCE: 由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `1-3-butadiene → acrylonitrile → 1-3-butadiene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- ILLUSTRATIVE_CONCEPT: 異種原料を組み合わせる共重合体の考え方。実局所列をbulk比率・配列統計と区別。
- 子どもが探す対象: BD→acrylonitrile→BD由来、C≡N一個と残存C=C二個。
- 最低限の説明: 「2種類の原料から来た部分があります。二重結合と三重結合を見比べよう。」
- 起こりやすい誤解: 現2laneのCNをdouble扱い／有限2:1をbulk比とする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 全体組成比・cis/trans分布・random/block、加硫架橋の形成済み。
- Task③ 視覚的強調: V0 V1 V3 V5 V7。焦点は「BD→acrylonitrile→BD由来、C≡N一個と残存C=C二個」。副目標は別段階。
- Task④/⑤ 表示検証: CN一order3とdiene二order2を別集合。L1現2lane制約を⑤で解消、nitrile geometryと全origin保存。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1164](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1164); Task① matrixの`nitrile-butadiene-rubber`行; Task① S2/S3（vinyl, dieneの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 20. `polyisoprene`

- Polymer ID: `polyisoprene`
- Route ID: `polyisoprene-coordination-1-4`
- 主学習目標: E3
- 副学習目標: E2
- 教育的表示分類: C-UNSAT SIDE-METHYL BOND-2; reaction=`chain; diene`
- OBSERVED_GRAPH: four source-origin groups; C backbone with four C=C bonds and methyl substituents; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `isoprene → isoprene → isoprene → isoprene`、投入元4個、water 0個。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: 1,4編集後の四残存C=Cとmethyl側基。
- 最低限の説明: 「つながりが変わっても二重結合は残ります。鎖から出た小さな部分も探そう。」
- 起こりやすい誤解: メチルをjunction／全結合single化／天然ゴム配列と同一。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 天然ゴムのcis配列・微細構造比を確定。
- Task③ 視覚的強調: V0 V1 V3 V6 V7。焦点は「1,4編集後の四残存C=Cとmethyl側基」。副目標は別段階。
- Task④/⑤ 表示検証: 四C=Cとmethyl側基、実1,4編集、cis/transを割り当てずにlocal bond geometry。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1219](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1219); Task① matrixの`polyisoprene`行; Task① S2/S3（dieneの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 21. `butyl-rubber`

- Polymer ID: `butyl-rubber`
- Route ID: `butyl-rubber-cationic`
- 主学習目標: E4
- 副学習目標: E2
- 教育的表示分類: C-UNSAT SIDE-METHYL BOND-2 MIXED-LOCAL; reaction=`chain; vinyl, diene`
- OBSERVED_GRAPH: isobutene/isoprene/isobutene source-origin groups; geminal methyl substituents and one backbone C=C bond; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `isobutene → isoprene → isobutene`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。実代表1,4編集で二重結合位置/次数が変わりC=Cが残る。
- ILLUSTRATIVE_CONCEPT: 異種原料を組み合わせる共重合体の考え方。実局所列をbulk比率・配列統計と区別。
- 子どもが探す対象: isobutene→isoprene→isobuteneと一残存C=C、geminal methyl。
- 最低限の説明: 「この短い例は2種類の原料からできています。二重結合が残るところを探そう。」
- 起こりやすい誤解: 2:1が実butyl材料配合／側methylがnetwork。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; bulk比率、random/block、架橋密度や加硫済み構造。
- Task③ 視覚的強調: V0 V1 V3 V5 V7。焦点は「isobutene→isoprene→isobuteneと一残存C=C、geminal methyl」。副目標は別段階。
- Task④/⑤ 表示検証: 一残存C=Cと混合origin、methyl二個の接続と鎖の連続性を区別。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1271](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1271); Task① matrixの`butyl-rubber`行; Task① S2/S3（vinyl, dieneの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 22. `polyvinylidene-fluoride`

- Polymer ID: `polyvinylidene-fluoride`
- Route ID: `polyvinylidene-fluoride-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-HALOGEN; reaction=`chain; vinyl`
- OBSERVED_GRAPH: vinylidene-fluoride×4; F-bearing saturated C backbone; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `vinylidene-fluoride → vinylidene-fluoride → vinylidene-fluoride → vinylidene-fluoride`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: F-bearing炭素とH-bearing炭素を含む実C主鎖。
- 最低限の説明: 「鎖の炭素に、フッ素の原子がついているところを探そう。」
- 起こりやすい誤解: Fを主鎖とする／局所源配置を全regioregularityとする。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; bulk regioregularity、stereo、結晶相/圧電性を模型から確定。
- Task③ 視覚的強調: V0 V1。焦点は「F-bearing炭素とH-bearing炭素を含む実C主鎖」。副目標は別段階。
- Task④/⑤ 表示検証: F/H/C凡例とsource置換位置を保持、回転後もC主鎖経路を追跡可能。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1329](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1329); Task① matrixの`polyvinylidene-fluoride`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 23. `vinylidene-fluoride-hexafluoropropylene-copolymer`

- Polymer ID: `vinylidene-fluoride-hexafluoropropylene-copolymer`
- Route ID: `vinylidene-fluoride-hexafluoropropylene-radical`
- 主学習目標: E4
- 副学習目標: E2
- 教育的表示分類: C-SAT SIDE-HALOGEN SIDE-CF3 MIXED-LOCAL; reaction=`chain; vinyl`
- OBSERVED_GRAPH: vinylidene-fluoride→hexafluoropropylene→vinylidene-fluoride; source CF₃ side group; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=2、growth steps L=2。representation metadata P=2（追加原子/結合ではない）。実source列 `vinylidene-fluoride → hexafluoropropylene → vinylidene-fluoride`、投入元3個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 異種原料を組み合わせる共重合体の考え方。実局所列をbulk比率・配列統計と区別。
- 子どもが探す対象: VDF→HFP→VDFのoriginとHFP由来CF3側基。
- 最低限の説明: 「2種類の原料から来た部分があります。フッ素のついた横のまとまりを探そう。」
- 起こりやすい誤解: 全F同じだから全て同種原料／CF3が高分子分岐。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 全体組成比、random/block、regioregularityやstereo分布。
- Task③ 視覚的強調: V0 V1 V5。焦点は「VDF→HFP→VDFのoriginとHFP由来CF3側基」。副目標は別段階。
- Task④/⑤ 表示検証: CF3側接続と主鎖、H/Fのsource差を元素色とは別の由来凡例で確認。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1380](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1380); Task① matrixの`vinylidene-fluoride-hexafluoropropylene-copolymer`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 24. `polytetrafluoroethylene`

- Polymer ID: `polytetrafluoroethylene`
- Route ID: `polytetrafluoroethylene-radical`
- 主学習目標: E2
- 副学習目標: E1
- 教育的表示分類: C-SAT SIDE-HALOGEN; reaction=`chain; vinyl`
- OBSERVED_GRAPH: tetrafluoroethylene×4; saturated C backbone bearing F substituents; μ=0, orders=1。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=2（追加原子/結合ではない）。実source列 `tetrafluoroethylene → tetrafluoroethylene → tetrafluoroethylene → tetrafluoroethylene`、投入元4個、water 0個。反応対象C=CがC–Cとなり実分子間結合ができる。他の多重結合は一括消失しない。
- ILLUSTRATIVE_CONCEPT: 有限片とより長い鎖の関係／反復する接続の考え方。実Sampleに追加edgeはない。
- 子どもが探す対象: Fに囲まれたC主鎖とC–F置換結合。
- 最低限の説明: 「外側の原子の間から、つながる炭素の鎖をたどってみよう。」
- 起こりやすい誤解: Fが主鎖／見えないCを省略／らせんが唯一の形。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 特定helix/結晶充填、摩擦や耐熱性の直接測定。
- Task③ 視覚的強調: V0 V1。焦点は「Fに囲まれたC主鎖とC–F置換結合」。副目標は別段階。
- Task④/⑤ 表示検証: 全てのF原子とC主鎖を保持し、H原子を含まない実元素構成を守る。遮蔽をatom削除で解決せず回転/拡大で到達。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1432](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1432); Task① matrixの`polytetrafluoroethylene`行; Task① S2/S3（vinylの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

### 25. `nylon-6-6`

- Polymer ID: `nylon-6-6`
- Route ID: `nylon-6-6-direct-polycondensation`
- 主学習目標: E3
- 副学習目標: E2,E4
- 教育的表示分類: HET-AMIDE AMIDE BOND-2 TWO-SOURCE-COND; reaction=`step-growth; amide-condensation`
- OBSERVED_GRAPH: adipic-acid→hexamethylenediamine→adipic-acid→hexamethylenediamine; three amide links; μ=0, orders=1,2。
- REACTION_EVIDENCE: 由来跨ぎ結合X=3、growth steps L=3。representation metadata P=0（追加原子/結合ではない）。実source列 `adipic-acid → hexamethylenediamine → adipic-acid → hexamethylenediamine`、投入元4個、water 3個。実C(=O)–N連結と別partitionの水。
- ILLUSTRATIVE_CONCEPT: 酸由来＋glycol/diamine由来残基を組にするCRUの考え方。実端を含む4投入を完全CRU数へ置換しない。
- 子どもが探す対象: acid/hexamethylenediamine残基間C(=O)–Nと別水。
- 最低限の説明: 「2種類の原料の一部が鎖になり、一部は水になりました。窒素のあるつなぎ目を探そう。」
- 起こりやすい誤解: 4原料=4repeat／Nは水へ／6,6が投入数。
- UNCERTAIN_OR_UNSUPPORTED / 禁止断定: U0; 4完全repeat、結晶性や強度を有限片から確定。
- Task③ 視覚的強調: V0 V3 V4 V5 V6。焦点は「acid/hexamethylenediamine残基間C(=O)–Nと別水」。副目標は別段階。
- Task④/⑤ 表示検証: 三amide/三water/ports0、六Cのdiamine由来spanとcarbonyl–NH、長い実有限片の全体fitと局所識別。共通のgraph/atom origin不変量とV0を必須とする。
- 化学的証拠: [S1 route L1480](https://github.com/miyatayuuma/molecule-craft/blob/c2b106ee97a4148084507fc1d3e3eaab61759062/data/polymerization-routes.json#L1480); Task① matrixの`nylon-6-6`行; Task① S2/S3（amide-condensationの実commit/partition）。実座標はS5、描画はS4。一般論よりこの実graphを優先。

## Representative observation cases

全ケース6–9歳。共通の90秒/H0–H2/失敗コード/採点/再設計手順は [教育正本§10](polymer-local-fragment-task2-education.md#10-child-observation-protocol)。質問欄の全文（固定した追加質問を含む）をH0として毎回同じ順で読む。質問にない副目標を自発的に説明しなかったことで不合格にしない。各課題の正答箇所はTask④/⑥が実fixtureのfinal atom/bond indexへ照合して記録する。表の口頭短文だけで対象が指せない場合、理解PASSではない。全件**NOT_RUN**（児童観察）。

| Case / 主目標 | 提示する実模型と操作条件 | 非誘導の質問文 | 正答の必須対象・関係 | 許容/失敗・後工程の要件 |
|---|---|---|---|---|
| C01 PE / E1 | PE4投入の完成片、初期/reset。実端、C/H凡例。orbit/zoom可 | 「つながりをたどって、鎖の端からもう一つの端まで指してみて。」 | 実C主鎖の結合経路を途切れずたどり両端を示す。近接非結合へ飛ばない。H側路だけをたどらない | H1は操作のみ。主鎖を先になぞるのはH2。V0、全端を同じ初期画角で確認 |
| C02 PP / E2 | PP4投入、主鎖とmethylを同時に見られるview。副教材は閉じる | 「鎖をたどる道と、そこから出ている小さなまとまりを、一つずつ指して。二つがつながるところも指して。」 | 連続する主鎖部分と、一つの実methyl側基、その接続点。側基を高分子鎖3本のjunctionとしない | 画面の横という答えだけは不可。V1。methylの場所を色で教えるのはH2 |
| C03 PS / E2 | PS4投入。回転して環の閉路と側付着を確認 | 「輪を一つたどってみて。その輪は鎖の途中をつないでいる？鎖から出ている？鎖とのつながりも指して。」 | 六C環の実閉路をたどり、主鎖から一か所で出る側環と示す。全分子が一つの閉環とは答えない | 二択の回答だけでなく実接続点を指す。V1/V2、環の背面edgeもorbitで確認 |
| C04 PET / E3 | 実acid/glycol source→完成片→実分離waterを別段階で提示。元素凡例、由来は非色覚手掛かり併用 | 「原料の原子は、鎖になった部分と、別にできた水のどこにある？つなぎ目と、その両側がどちらの原料から来たかも指して。」 | 実C(=O)–O結合部位一つとsource双方への対応、水一分子を別productとして指す。水の原子を最終Sampleの同一原子と二重計上しない | 「エステル」の語は不要。水を指すだけは不十分。V4/V5/V6。副段階で二主鎖環とCRU/4投入差を保護者説明 |
| C05 Nylon-6,6 / E3 | acid/hexamethylenediamine source→完成片→実water。N/O凡例。zoomでcarbonyl–N | 「鎖になったつなぎ目で、窒素のあるところを指して。両側はどちらの原料から来た？別にできた水も探そう。」 | 実C(=O)–N連結を一つ、鎖内Nと別waterを区別。source両方の残基が結ぶと指示可能 | Nの色だけでなく凡例と接続で正答。V3/V4/V5/V6。三amide/三waterは実証拠だが児童の全数暗唱は要求しない |
| C06 PEO / E3 | 実ethylene-oxideの三員環を前状態で提示し、完成片と切替。完成graphのみの回転可 | 「原料の輪と、つながった後の同じ原子の道を見比べよう。輪はどうなった？」 | 元C–C–O閉路と最終の開いた主鎖C–O経路を指す。最終には元の閉路がなくOは主鎖に残る | 口頭で「開く」だけは不足。V4/V6。水ができたという誤答を記録。元環のghostを最終Sampleに付けない |
| C07 PAN / E2 | 完成PAN、element凡例と1/2/3結合の中立凡例。reset/zoom | 「炭素と窒素の三重結合を一つ、鎖の一本の結合を一つ指して。違いを見せて。」 | 実側C≡N（order3）と主鎖single edge（order1）を区別。線3本=3原子としない | L1解消前はV失敗/試験未準備であり児童誤概念としない。V1/V3。NBRでもorder2と3の追加実画面照合 |
| C08 SBR / E4 | BD→styrene→BD実有限片、source別比較。主段階の後に環/残存C=Cを個別提示 | 「2種類の原料から来た部分を指して。この短い例だけで、長い高分子全体の混ざり方まで分かる？」 | styrene由来側環とBD由来残存C=Cの位置を指し、全体比・random/blockはこの例だけで分からないと答える | 用語random等は要求しない。先に『分からないよね』と言わない。V2/V3/V5/V7。副段階では環内二重結合と主鎖C=Cを別に指す |
| C09 PF / E4 | 実2環片と独立network図を別枠/別題/別identityで提示。どちらにも出自説明。保護者用L2留保 | 「今ゲームでつないだ短い模型はどっち？その中の二つの輪がつながるところも指して。もう一方の図は何を説明するもの？」 | 実2環片を選び二環間CH2連結を指す。別図は網目構造を説明する模式例で、今合成した同一Sampleではないと答える | 文字の読み上げだけでなく実二環/連結を指す。V8。ortho/para正解や実junction探索は採点しない。図鑑と同一との誤解をM2/M3/M9として記録 |

### Detailed scientific guardrails for the nine cases

- **PE**: `sample.fragment`のC–C経路を実端で止める。4etheneの由来と化学的反復という別概念を同じ色分けで一体化させない。未充足valenceをH球で補わない。
- **PP**: CH3は重合主鎖からの側基であってpolymer-chain branchではない。原子Cのdegreeだけでは鎖トポロジーを分類できない。表示の手前/横は化学的役割を決めない。
- **PS**: 芳香環は四つ、主鎖はC–C。実order1/2の環をたどるが、この描画からπ電子が固定位置にあると教えない。styreneのvinyl結合変化はREACTION_EVIDENCEであり完成片の環の次数と分ける。
- **PET**: acid→glycol→acid→glycol。実4投入/3ester/3water/2環/ports0。二種由来の残基はCRU概念の構成に関係するが、有限端を含む片を整数個の完全CRUへ無条件分割しない。環は両側の連結を媒介し、PSの一側付着とは異なる。
- **Nylon-6,6**: 実4投入/3amide/3water/ports0。二種原料acid/hexamethylenediamineを区別し、PE-adipamideのethylenediamineと取り違えない。「6,6」は投入元の個数ではない。N–HとC=Oを消さず実端基を保持する。
- **PEO**: 四epoxide sourceの実開環が証拠。完成片μ0、order1、主鎖O、water0。元の環を概念提示する場合は反応前状態であり現在の生成物graphと合成しない。
- **PAN**: 四C≡Nは化学graphのorder3。renderer二lane制約L1は科学データとは別。子どもに「二重に見えるので二重結合」と学習させない。C≡Nの角度妥当性は④、次数の見え方は⑤が担う。
- **SBR**: 局所BD→styrene→BD、環1、鎖内残存C=C2。ring内のorder2は別集合。局所source列は事実でもbulk比2:1、random/block、加硫架橋は不明。配列/配座を発明しない。
- **PF**: 実2環/一methylene bridge/hydroxymethyl/一water。静的authorityの独立4環/3bridge motifを実合成結果へ差替えない。first-available site選択L2は化学妥当性未認証。形成能力の理解とこの位置選択の是非を別にし、教科書的な位置選択の正例として採用しない。

## Misconception review coverage

全25詳細ブロックの「誤解」「禁止断定」、共通U0と正本M1–M9をレビュー対象とする。副目標にも適用。監査の実行結果・finding・修正・reviewer識別はTask② PR記録がauthorityであり、この対象リスト自体は独立review PASSを意味しない。

| 観点 | 全25に適用する確認 | 特に反証する例 |
|---|---|---|
| M1/M2 | 実edge/端の保持、全鎖との区別、continuationを原子化しない | PE全体化、縮合ports0の偽末端 |
| M3/M4 | 側基とjunction、環の位置と全環状分子の区別 | PIB/CF3のdegree、PS側環/PET主鎖環/PF二環 |
| M5/M6 | 局所source列とbulk統計、確定接続と例示配座を分離 | 5MIXED-LOCAL、PVDF regiochemistry、diene cis/trans |
| M7 | 各transformの実次数/開環/水/partitionに一致 | PEO water0、6縮合water3、PF water1とL2 |
| M8/M9 | 色/次数/重なりの制限と一般材料概念を隠蔽しない | PAN/NBR L1、PF network能力、PTFE helix/結晶 |

## Appendix A — reproducible specification check

repository rootで次のJavaScript blockだけを `node --input-type=module` の標準入力へ渡す。文書検査であり、文章の科学的独立reviewを自動代替しない。Task①の数値正本を採用し、Task②に必要なID・分類・反応・metadataの対応を検証する。全25のXをTask①正本と照合し、Lはroute completion evidenceと照合する。PFでX=4とL=3を区別し、詳細の由来claimの欠落も不合格にする。Coreの原子保存は既存fixture testを別実行する。 統合差分のscope比較基準はCI修復PR #349を取り込んだmain `512dc7e550154bdbe9baf960b0609c41961a20f3`。Task①からの化学入力は不変で、独立修復のtest/CI差分を教育PRの変更と混同しない。

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
const dir='docs/validation/';
const spec=dir+'polymer-local-fragment-task2-education.md';
const matrix=dir+'polymer-local-fragment-task2-education-matrix.md';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const authority=await read('data/polymerization-routes.json');
const [md,edu,old]=await Promise.all([matrix,spec,dir+'polymer-local-fragment-route-matrix.md'].map(p=>readFile(p,'utf8')));
const rows=md.split('\n').filter(l=>l.startsWith('| `')).map(l=>l.split('|').slice(1,-1).map(c=>c.trim().replaceAll('`','')));
const previous=old.split('\n').filter(l=>l.startsWith('| `')).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()));
const sections=[...md.matchAll(/^### (\d+)\. `([^`]+)`\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
assert.equal(rows.length,25);assert.equal(sections.length,25);
for(const col of [0,1])assert.equal(new Set(rows.map(r=>r[col])).size,25);
const sorted=a=>[...a].sort();
assert.deepEqual(sorted(rows.map(r=>r[0])),sorted(authority.routes.map(r=>r.polymerId)));
assert.deepEqual(sorted(rows.map(r=>r[1])),sorted(authority.routes.map(r=>r.routeId)));
assert.deepEqual(sorted(rows.map(r=>r[0])),sorted((await read('data/polymers.json')).map(r=>r.id)));
const fields=['Polymer ID','Route ID','主学習目標','副学習目標','教育的表示分類','OBSERVED_GRAPH','REACTION_EVIDENCE','ILLUSTRATIVE_CONCEPT','子どもが探す対象','最低限の説明','起こりやすい誤解','UNCERTAIN_OR_UNSUPPORTED / 禁止断定','Task③ 視覚的強調','Task④/⑤ 表示検証','化学的証拠'];
for(const route of authority.routes){
 const row=rows.find(r=>r[0]===route.polymerId),sec=sections.find(s=>s[2]===route.polymerId)?.[3];
 assert.equal(row[1],route.routeId);assert.match(row[2],/^E[1-4]$/);
 const secondary=row[3].split(',');assert.ok(secondary.length<=2);secondary.forEach(g=>assert.match(g,/^E[1-4]$/));assert.ok(!secondary.includes(row[2]));
 assert.ok(sec,route.polymerId);
 for(const field of fields)assert.ok(sec.split('\n').some(l=>l.startsWith('- '+field+': ')&&l.length>field.length+5),`${route.polymerId}: ${field}`);
 assert.ok(sec.includes('- 主学習目標: '+row[2]));assert.ok(sec.includes('- 副学習目標: '+row[3]));assert.ok(sec.includes('`'+route.routeId+'`'));
 assert.ok(sec.includes('U0;'));assert.ok(sec.includes('V0'));assert.ok(sec.includes('Task① S2/S3'));
 for(const tag of row[4].split(' '))assert.ok(edu.includes(tag),tag);
 assert.equal(row[5],route.builder+' / '+route.transformFamilies.join(', '));
 const p=previous.find(r=>r[0].startsWith('`'+route.polymerId+'` /'));
 assert.ok(p);assert.equal(row[6],p[1]);assert.equal(row[7],p[3].split('/')[2]);assert.equal(row[8],p[4]);assert.equal(row[9],p[7]);assert.equal(row[10],p[5]);
 assert.equal(Number(row[6]),route.completionEvidence.unitCount);assert.equal(Number(row[9]),route.completionEvidence.byproducts.water);
 assert.equal(row[11],p[6],'Task① cross-origin X: '+route.polymerId);
 assert.equal(Number(row[12]),route.completionEvidence.interUnitLinks,'growth L: '+route.polymerId);
 assert.ok(sec.includes(`由来跨ぎ結合X=${row[11]}、growth steps L=${row[12]}。`),'missing/mismatched origin claim');
 assert.equal(Number(row[12]),Number(row[6])-1);
 if(route.polymerId==='phenol-formaldehyde-resin'){
  assert.equal(Number(row[11]),4);assert.equal(Number(row[12]),3);
 }else assert.equal(row[11],row[12]);
 assert.ok(sec.includes(route.representativeSequence.join(' → ')));
 const v=sec.match(/- Task③ 視覚的強調: (.*?)。/)[1].split(' ');for(const key of v)assert.match(key,/^V[0-8]$/);
}
const pf=sections.find(s=>s[2]==='phenol-formaldehyde-resin')[3];
for(const term of ['L2','実二環','独立図鑑','三方向junction'])assert.ok(pf.includes(term),term);
for(const id of ['polyacrylonitrile','nitrile-butadiene-rubber'])assert.ok(sections.find(s=>s[2]===id)[3].includes('L1'));
assert.equal((md.match(/^\| C\d{2} /gm)||[]).length,9);
for(const cls of ['OBSERVED_GRAPH','REACTION_EVIDENCE','ILLUSTRATIVE_CONCEPT','UNCERTAIN_OR_UNSUPPORTED'])assert.ok(edu.includes(cls));
for(const term of ['NOT_RUN','H0','H1','H2','90秒','6–9歳','再設計'])assert.ok(edu.includes(term),term);
for(let i=1;i<=9;i++)assert.ok(edu.includes('M'+i));
const allowed=[spec,matrix,'docs/architecture.md'];
for(const file of allowed){
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1];if(/^(https?:|#)/.test(target))continue;
  await readFile(resolve(dirname(file),target.split('#')[0]));
 }
}
const diff=execFileSync('git',['diff','--name-only','512dc7e550154bdbe9baf960b0609c41961a20f3'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of [...diff,...untracked])assert.ok(allowed.includes(file),'non-document scope: '+file);
console.log('PASS: 25 exact polymer/route pairs; unique IDs; goals; 15 contract fields; taxonomy; four evidence classes; Task① counts/families/cross-origin X vs growth L; L1/L2; nine cases; links; documentation-only scope');
```
