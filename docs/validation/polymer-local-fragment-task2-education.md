# Local finite polymer 3D — Task② educational authority

## 1. Objective and authority

全25ルートについて「何を、どの証拠から、どう観察するか」を確定する規範仕様。MUST / MUST NOTは後工程の受入要件。対象は低学年を含む子どもが実際に合成した有限断片であり、教育効果の実証報告ではない。Task②は文書のみを変更する。

優先入力は [Task①正本](polymer-local-fragment-task1-authority.md) と [Task①全ルート監査表](polymer-local-fragment-route-matrix.md)。本仕様と [Task②教育マトリクス](polymer-local-fragment-task2-education-matrix.md) を一組で使用する。Task①の化学・保存・renderer所有権は複製せず継承する。

開始main: `96a7ec72643eddd140cedeb311c45c36bd07202a`（Task① PR #346 merge）。Task①開始sourceからの差分は7文書のみで、対象route/Core/runtime/dataに変更なし。最新preflightではmainのfinite CI [39127011872](https://github.com/miyatayuuma/molecule-craft/actions/runs/39127011872) はSUCCESS（historical、今回の試験ではない）。[PR #345](https://github.com/miyatayuuma/molecule-craft/pull/345) はOPEN/unmerged、HEAD `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`、unresolved thread 0。先行PRのFAILはmainの上記SUCCESSで上書きしない。#189もOPENだが本仕様の所有対象ではない。

化学的証拠は常にruntime `PolymerSample.fragment`、その`atomOrigins`とreaction evidence。一般的名称、静的SVG、見かけの配置で置換しない。「確定」は実装モデル内の接続に対する確定であり、全経路の実験化学的認証を意味しない。

## 2. Educational design principles

- 1段階の主目標は1つ。副目標は最大2つ、別の観察段階で提示する。全ルートで全概念を教えない。
- 低学年の成功は専門用語の暗唱でなく、実際の原子・結合を指す／たどる／違いを示すこと。
- 短い説明を模型上の対象と対応させる。色のみの指示は禁止。形、接続、文字による元素凡例や選択状態の非色覚依存手掛かりを併用する。
- 全原子・結合・次数・由来を保持する。Hや混雑した置換基の削除、生成物に見える追加鎖、仮の末端キャップは禁止。
- 初期表示、回転、拡大、resetの観察導線を必要条件とする。新しい注釈や反応比較機能は**要求**であり、実装済みと記載しない。
- 材料特性や架橋能力の一般説明は実サンプル観察とは別段階・別枠。密度、強度、結晶性を球の並びから測定したように説明しない。

## 3. Final learning objectives

E1–E4の4領域を採用する。E1はつながり、E2は部分の区別、E3は前後変化、E4は複数原料と推論限界であり、同じ課題を言い換えただけの分類にしない。

| ID | 理解すべき内容 | 証拠 | 典型的誤解 | 確認方法 |
|---|---|---|---|---|
| E1 鎖の連続性 | 実在する結合をたどり、表示中の主鎖範囲と両端を見つける | OBSERVED_GRAPH: backbone route motif、実結合と末端。連続先の原子は含めない | 近い球が結合／有限片が高分子全体／投入数=repeat数 | PEの両端を結ぶ連続経路を指し、画面にない先は指せないと説明 |
| E2 構造上の違い | 主鎖と側の原子団、環の位置、多重結合、官能基を区別 | OBSERVED_GRAPH: 接続・次数・元素。座標上の上下は根拠にしない | メチル=分岐高分子／環=環状高分子／太さ=結合次数 | PP/PS/PAN等で本表指定の対象と隣接部分を区別して指す |
| E3 重合による変化 | 実際に変わった結合と、残った部分／分離した水を区別 | REACTION_EVIDENCE + OBSERVED_GRAPH: 実sourceとcommit差分、byproduct partition | 全C=C消失／Oは全て水／PEOは今も環状／縮合=原子消滅 | 前後を対応させ、変化箇所と保存部分、別生成物を指す |
| E4 多様性と限界 | 異種原料由来の局所差と、模型だけで不明な事項を区別 | OBSERVED_GRAPH origins、REACTION_EVIDENCE sequence、ILLUSTRATIVE_CONCEPT capability | 有限配列=全体比率やrandom/block／PF=実ネットワーク／配座が唯一 | SBRの二由来特徴を指し全体比率は分からないと答える。PF二表示を分ける |

E1は全ルート共通の観察前提だが、各routeの主目標をE1に重複設定する必要はない。E4の不確実性は全ルートの説明制約であり、全児童に毎回抽象的な限界説明を試験する義務ではない。

## 4. Educational taxonomy

マトリクスの各行は以下の独立軸を持つ。単一の「直鎖/環/共重合体」排他分類にしない。

| 軸 | 確定した値・解釈 |
|---|---|
| 主/副目標 | E1–E4。主1、副0–2 |
| 主鎖 | C-SAT=飽和C主鎖、C-UNSAT=残存C=Cを含むC主鎖、HET-ETHER=エーテルOを含む主鎖、HET-ESTER=エステル経路、HET-AMIDE=アミド経路、PF-FINITE=PF実装の二環連結片 |
| 部分構造（複数可） | SIDE-METHYL、SIDE-HALOGEN、SIDE-CF3、SIDE-ACID、SIDE-NITRILE、RING-PENDANT、RING-BACKBONE、RING-PF、BOND-2、BOND-3、ETHER、ESTER、AMIDE、HYDROXYMETHYL |
| 原料・能力（構造と独立） | MIXED-LOCAL=現routeが共重合体として定義する異種原料局所列、TWO-SOURCE-COND=二種原料縮合、SELF-COND=同種原料縮合、NETWORK-CAPABILITY=一般的な形成能力。二種縮合をMIXED-LOCALと自動的に同一視しない |
| 反応 | route.builder + route.transformFamiliesをそのまま記録。開始方式はroute IDに保持。分類は反応速度・機構全体の実証ではない |
| 注意 | 全route共通U0 + 行固有の制約。原料数、実端基、三重結合L1、PF位置選択L2は明記 |

### Evidence classes

全行に以下の4欄を必須とする。1つの説明に複数classがある場合は節を分ける。空欄は不可、非該当は「なし」とする。

| Class | 許容される内容 | 表示上の扱い |
|---|---|---|
| OBSERVED_GRAPH | 実Sample内の元素・接続・次数・source origin | 「この模型では…」。実グラフに照合できる対象だけ |
| REACTION_EVIDENCE | 実routeのsource、commit差分、順序、ringOpenings、水など | 元と生成後／主生成物と副生成物を比較。最終模型単独から反応過程を観測したとは言わない |
| ILLUSTRATIVE_CONCEPT | CRU、実材料全体、架橋形成能力、独立図鑑模式図 | 「しくみの説明」「このサンプルとは別の模式図」。同じSample IDを付けない |
| UNCERTAIN_OR_UNSUPPORTED | tacticity、cis/trans分布、全体組成、random/block、結晶、全鎖形状、架橋密度、PF位置選択の化学妥当性 | 確定事実として教えない。必要時「この模型だけでは分かりません」 |

**U0**: 全routeで座標は例示的、実装の原子グラフは実材料全体ではない。上記不確実事項は情報不足。route qualifierがないことも確定根拠にならない。局所の実source順序を隠す必要はないが、統計分布へ外挿しない。

## 5. Repeat-unit and finite-fragment communication

- 共通短文: 「ゲームでつないだ短い部分です。もっと長い高分子では、つながりが続きます。この模型の形は一例です。」前半はOBSERVED_GRAPH、後半はILLUSTRATIVE_CONCEPT。実際に長鎖を生成したとは言わない。
- 実Sampleの始点・終点を実結合の端として示す。方向は観察の便宜で、反応の絶対方向や固有の物理的始点を主張しない。環では選んだ観察経路が環内を2通りにたどれてもよい。
- 「投入元の分子4個」と「繰り返し単位4個」は別。`completionEvidence.unitCount`をCRU数として表示しない。PEでもorigin境界とCRU境界が一般に同義と学習させない。
- PEのC–C区間など、確定した反復**接続パターン**を提示できる。ただし括弧の境界を新たな切断／結合と見せない。末端や欠損valenceを完全な反復単位の一部として数え上げない。
- PET/二種アミド等は酸由来とグリコール/ジアミン由来の**残基**が組になるCRU概念を別枠で説明。実4投入・3連結・3水を「完全repeatが4つ」や「末端を無視して完全repeatが2つ」と断定しない。
- 同種縮合も、元の分子が水の原子を全て持ったまま残る図にしない。originは残った各原子への由来、元分子全体の輪郭コピーではない。
- 共重合体は実有限source列を示してよい。繰り返される周期、bulk比率、random/blockラベルを付けない。
- 未表示の先は短い説明やUI注釈で示し、実端に追加の棒・球・半透明鎖・点線の共有結合を足さない。非化学的注釈は実模型から視覚的に分離する。
- 18 chain routesの実continuationsはvalence-deficit metadata。6縮合routeとPFは0。route-level markerからportsを補わない。端を現実の安定分子としてHで終端したとも言わない。

CRUの用語基準はIUPAC [constitutional repeating unit](https://goldbook.iupac.org/terms/view/C01286)、構成単位は [constitutional unit](https://goldbook.iupac.org/terms/view/C01288)（2026-10-18参照）。この定義の採用はruntimeグラフ変更の根拠にならない。

## 6. Linear/side-group/ring/crosslink distinction

| 区別 | 実サンプルの扱い | 禁止する説明 |
|---|---|---|
| 主鎖と側基 | route反応部位を通ってsource残基を結ぶ経路と、そこから出るメチル/Cl/F/CN等を分離。Cの次数3だけで高分子鎖分岐としない | PP/PIB/CF3を三本の高分子鎖と呼ぶ |
| 主鎖分岐 | 3本以上の独立した高分子鎖の腕が結ぶjunction。本25有限Sampleでは未確認 | 教育分類を埋めるためjunctionを追加 |
| 側環 | PS/SBRの芳香環は主鎖からの置換基。閉路はあるが全体は環状高分子でない | 「鎖全体が輪」「芳香環=架橋」 |
| 主鎖内の環 | PETでは両側の残基への接続を芳香環が媒介。環の二経路を保持 | 表示用に環の半分を消す／一直線化 |
| PFの環 | 二つの実環とメチレン連結を観察。位置選択のL2を保持。主鎖の教科書的模範には採用しない | 実2環を図鑑4環networkと同一視 |
| 架橋 | 異なる高分子鎖を結ぶ連結。今回実サンプルには確認された鎖間架橋・三方向鎖接合を提示しない | メチレン結合1本だけで架橋ネットワーク完成とする |
| 形成能力 | PFの一般的なネットワーク形成能力は別の概念説明。図鑑独立network motifはILLUSTRATIVE_CONCEPT | `builder=network`や`NETWORK CONTINUES`を実junctionの観測証拠にする |

主鎖の識別は画面の左右・最長の原子経路・raw origin quotientのdegreeで決定しない。Task④/⑤はrouteの既存反応部位、実inter-unit結合とsource内経路を使い、上記マトリクスの化学役割をatom/bond集合へ対応させる。芳香環は一つの環blockとして扱い、sourceをまたいだH移動は主鎖接合から除外する。特にPFのcross-origin bond数4とgrowth step数3を混同しない。注釈対象集合は由来tupleとfinal graph indexで検証し、化学的にないedgeを経路補間しない。

## 7. Copolymer and condensation education

MIXED-LOCALの5例はEP、SBR、NBR、butyl、VDF–HFP。source列はrouteどおり3投入。二種縮合の4例（PET、PE-adipate、PE-adipamide、nylon-6,6）はTWO-SOURCE-CONDとして扱い、両者を同じ統計的配列の説明へ押し込まない。同種縮合はPLA/PGAの2例。

- ビニル: 元の反応対象C=Cの次数変化と新しい分子間C–Cを区別。残った芳香環C=C、CN等まで消えたとは言わない。
- ジエン: このrouteの代表的1,4編集による残存C=Cを示す。全実材料の1,4比率やcis/trans分布は説明しない。
- PEO: 元の三員環と、開いた後のC–O–Cを対応。実ringOpenings=4、最終閉路0、水0。元と生成後の模型を別状態として比較する必要があり、完成模型に輪を描き足さない。
- エステル: C(=O)–Oの実結合とC=Oを区別。PET/PE-adipate/PLA/PGAで3ester links、3water。
- アミド: C(=O)–Nの実結合、N–HとC=Oを区別。PE-adipamide/nylon-6,6で3amide links、3water。
- PF: 実二環、methylene bridge、hydroxymethyl、1waterを記録。全4投入を4repeatとしない。phenol Hがformaldehyde Oへ移るorigin例を、残基全体の固定境界の証拠に使わない。

水はbyproductとして生成・分離した原子のまとまり。最終sample内のOを一律「水になったO」と教えない。water-removal設定は工程条件であり、分子がどの速度で蒸発したかの実測ではない。反応比較に必要なsource、最終fragment、byproduct partitionの並列表示/段階提示は将来要件であり、現行画面に全機能があるとの主張ではない。

## 8. Graph certainty and conformation uncertainty

接続と次数の根拠はTask① S1–S3。3D座標はTask① S5による例示的配置。回転・拡大は同じ接続を違う方向から見る操作であり、反応や立体異性体変換ではない。配置の違いを結晶形・分子の唯一の実形・安定エネルギー構造と呼ばない。

**L1**: PANの4本、NBRの1本のC≡NはOBSERVED_GRAPHのorder 3。現`updatePolymerBondVisuals()`はorder>=2を2laneにしており、次数視認は未達。Task③は1/2/3を区別する非色覚依存の視覚規則を指定し、Task⑤が解消、Task⑥が実画面検証する。説明を「二重結合」に変えて隠さない。

**L2**: PFの`phenolAttachmentSite()`のfirst-available C–H選択にはortho/para filterがない。Task①§9が示す化学評価未完了を継承。現接続は実装観測に限り紹介し、標準的レゾール位置選択の正解問題にしない。Task③/⑤の表示改善で修復済みと扱わない。別scopeの化学評価が欠陥を確定した場合は別chemistry変更と再検証が必要。Task⑥でこのルートの化学的妥当性を無条件PASSにしない。

## 9. Age-appropriate explanation rules

短文1–2文を主説明とし、詳説は保護者用。専門語を知らなくても正答できる。以下の短文は対象を指す導線を伴う必要がある。

| 表現 | 採用する説明 | 境界 |
|---|---|---|
| 分子がつながる | 「原料の原子のつながりが変わり、新しい結合でつながりました。」 | 元分子が形も結合も全く変わらず接着されたとは言わない |
| 同じ形が続く | 「似たつながりのまとまりが見つかります。曲がり方は一例です。」 | 接続の反復と見た目の姿勢の一致を混同しない |
| 横についている | 「鎖をたどる道から、こちらに出ている部分です。」 | 画面上の横方向、別高分子鎖の存在を意味しない |
| 輪になっている | 「この部分は結合をたどると元のところへ戻れます。」 | 分子全体が環状とは言わない |
| 水ができて離れる | 「原料の一部の原子は、水になって別に分かれました。」 | 水の全原子のpartitionを照合。原子消滅や主鎖Oの全脱離としない |
| いろいろな原料 | 「この短い例には、2種類の原料から来た部分があります。」 | 全体の比率・配列統計・全高分子が複数種原料とは言わない |

球の色の名前だけで正解を誘導しない。「本物はこの形」「全部同じ向き」「必ずこの割合」は禁止。原子色の凡例がないままN/O/F/Clを色だけで判別させない。結合線3本は結合次数3の模型表現であり、原子3個、独立した分子3本という意味ではない。

## 10. Child observation protocol

### 対象・準備・提示順序

- 対象帯6–9歳（主対象は小学校低学年）。読字・専門語・化学学習歴を記録するが、必須条件にしない。5歳以下や10歳以上の結果は別記し同じ判定へ混ぜない。
- [マトリクスの代表9課題](polymer-local-fragment-task2-education-matrix.md#representative-observation-cases)を使用。E1→E2→E3→E4の順で1段階1目標。1回のsessionは最大3課題、残りは別session。各課題最大90秒。無理に全9課題を連続させない。
- 記録: main/source SHA、route/sample ID、fixture/source sequence、device/viewport/DPR、motion設定、初期view/reset、全注釈文、凡例、反応比較状態、課題順、日時、年齢帯、既経験。個人名・顔/音声記録は不要。
- Task③指定のmobile/desktop初期viewをresetして提示。主目標の短文と元素/結合凡例を読む。テストの正答箇所を色やpointerで先に示さない。副目標注釈は閉じる。
- 30秒の練習は**別の通常分子**でorbit/zoom/resetだけ。保護者が操作を代行した場合は記録し、操作可能性と概念理解を別採点する。
- E3は元の実sourceと実生成後、該当する実水を別状態で提示。E4/PFは実Sampleと独立図鑑模式図を明確に別題で提示。比較UI未実装なら実施準備不足であり児童不正解としない。

### ヒント・採点・記録

| code | 許容行動・結果 | 採点 |
|---|---|---|
| H0 | 初回質問と短文/凡例を一度読む。以後誘導なし | 正しい対象/関係を示せば独力概念成功 |
| H1 | 同じ質問を一度読み直す、回転/拡大/resetの操作方法だけ案内。場所・色・答えを教えない | 正答は操作支援あり概念成功。操作独力成功とは別 |
| H2 | 正答部分を指す、元素名や位置を答えへ誘導、正誤を途中で教える | 教示後成功として別記、受入の独力/非誘導成功に数えない |
| V | 対象が重なる/小さすぎる/凡例や次数が読めない | 視覚設計失敗。無回答を知識不足と決めつけない |
| I | pointer競合/操作不能/戻せない | 操作失敗。概念成否を別記 |
| C | 指示は理解するが構造関係を誤る | 概念失敗。指した対象と理由を逐語または忠実に記録 |
| L/T | 言語が理解できない/時間切れ・疲労・拒否 | 無効または未完。勝手に成功/概念失敗に置換しない |

各ケースの正答表に照合し、対象atom/bondのID集合（またはスクリーンショット上の指示箇所）、発言、H0/H1/H2、V/I/C/L/T、秒数を記録。画面操作だけできても概念PASSにしない。専門語の言い間違いは対象関係が正しければ不合格にしない。答えを与えた同課題の再回答は初回の代わりにしない。

### 合格基準と再設計

個別課題はマトリクスの必須対象/関係を**全て**H0またはH1で示すこと、誤った余分な結合や全体断定を伴わないことを概念成功とする。H1は独力操作結果と分ける。未提示の副目標は採点しない。

後工程の小規模形成的観察は各代表ケースにつき異なる6–9歳児3名分を目安に計画し、ケース単位で2/3以上の非誘導概念成功、かつ同じ重大誤解（架橋/全鎖/比率の誤認）が2名以上で生じないことを暫定設計基準とする。これは製品設計上の暫定閾値であり、教育効果の統計的推定ではない。対象児が少ない場合は実数とNOT_VERIFIEDを報告し、成人/専門家による照合で児童観察を代替PASSにしない。

対象が見えないVや次数誤表示は専門家照合だけでも再設計対象。2名以上同じC誤解、V/I反復、H2依存、上記ケース基準未達は該当説明/visual/interactionを修正する。新versionで再試験を計画し、以前の失敗を保持。年齢外や疲労による無効データは理由を保持し、都合のよい結果だけ抽出しない。

児童観察はTask②では**NOT_RUN**。このプロトコル完成でLayer Aを受け入れられるが、Layer Bの実児童理解や学習効果を実証済みと扱わない。Task⑥でも未実施ならその範囲を明示する。

## 11. Objective acceptance criteria

### Layer A — Task②仕様受入

1. Production polymer/routeの25組とマトリクスの25組がset-equal、重複なし。全行に主1、副0–2、taxonomy、反応分類、4 evidence classes、観察対象、短文、誤解、禁止断定、視覚要件、④/⑤検証、sourceがある。
2. 数値（U、cycle rank、水、次数、ports、origin）はTask①表と同じ。Task②はその全経路再監査ではなく、必要なfixture/ID/主張の照合を行う。
3. E1–E4が観測/反応証拠または別枠の概念と対応。存在しない分岐・架橋・端原子を導入しない。
4. 側環/主鎖環/環状全分子、主鎖側基/鎖分岐、PF独立networkを分離。共重合体の局所列、縮合残基とCRUの違いが明示される。
5. L1とL2が保持され、可視化未達や化学評価未完了を教育文の変更で隠さない。
6. 9代表ケースが非誘導の質問・正答・提示条件・失敗記録を持ち、Task③へV要件を渡せる。児童試験NOT_RUNを保持。
7. 相対Markdown参照、差分scope、hygieneが正常。production/data/tests/CI/PWAを変更しない。独立reviewのblocking findingsを解消し、PR/mainとpost-mergeを確認。

### Layer B — Task③〜⑥実画面・観察受入

Task③は9代表ケースをmobile/desktopの視覚受入セットへ変換し、全25は行別V要件を満たす。Task④は実グラフと注釈対象集合/geometry、Task⑤は描画と操作、Task⑥は統合証拠を担当。専門家のgraph照合、成人の操作成功、実児童の概念成功の記録を混ぜない。Layer BはTask②の新規実行結果ではない。

## 12. Misconception prevention

独立reviewは全25行へM1–M9を適用する。行固有の「誤解」「禁止」とU0を組み合わせて判定し、反例は説明/分類を修正する。化学データで辻褄を合わせない。

| ID | 反証質問 | 必須の防止策 |
|---|---|---|
| M1 | 実在しない結合をたどらせるか | 実edgeのみ、注釈は非共有結合として分離 |
| M2 | 全高分子と誤認するか | 短い実例、真の端、未表示の先は概念 |
| M3 | 側基を架橋にするか | route役割による主鎖/側基。junctionなしを保持 |
| M4 | 環=環状高分子か | 環の位置と全体を別判定 |
| M5 | 局所列=bulk比/sequence統計か | MIXED-LOCAL、全体比不明 |
| M6 | 座標を唯一の実体にするか | 例示的配置、stereo/microstructureはU0 |
| M7 | 前後説明が実反応と合うか | 反応対象次数変化、source/partition、L2留保 |
| M8 | 色/本数/混雑の制限が誤学習を誘うか | 凡例・非色覚手掛かり、L1解消、V要件 |
| M9 | 材料の性質を直接観測とするか | 一般概念とSample観測を分離 |

## 13. Task③/④/⑤/⑥ handoff

| 所有者 | 確定した入力・必須成果 |
|---|---|
| Task③ appearance | 下記V0–V8と全25行/9ケースを用いる。何を強調するかは確定済み。半径/材質/色/画角/数値/括弧の最終意匠はTask③で決定。教育目的で追加原子を作らない |
| Task④ geometry | 現SampleとTask①graph/origin不変量。環・nitrile・carbonyl/ester/amide/etherのgeometryを対象に、画面上で区別できる配置の基盤を作る。注釈用atom/bond対象はsource役割をfinal indexへ写像。L2はgeometry修正で解決不可 |
| Task⑤ renderer/UX | order=1/2/3の非色覚依存区別、全原子表示、凡例、主鎖/側基/環・originの区別、実水との比較導線。orbit/pinch/wheel/reset、hit所有権とclose/reopenを保持。追加注釈は合成graphと別資源。#345 resize修復と最新mainをreconcile |
| Task⑥ acceptance | 全25行Vとgraph identity、9代表ケース実画面、mobile/desktop、normal/reduced-motion、操作/E2E/保存/cleanup/real RAF/strict gateを統合。児童観察は本protocol、未実施と性能FAILを隠さない。PF化学評価を別に判定 |

| V | 教育上の視覚必要条件（数値・配色の指定ではない） |
|---|---|
| V0 | 初期/resetで実有限範囲と実端を確認できる。回転/拡大で指定atom/bondへ到達でき、UIと模型が干渉しない。例示的配置の短い説明 |
| V1 | 主鎖の経路と側基の接続点を同時比較。注釈を切替えても全原子/結合を保持し、色だけに依存しない |
| V2 | 環を閉じた実edge列としてたどれ、主鎖への一か所の側付着/主鎖を媒介する二側接続を比較。PFは別の実装例 |
| V3 | 原子凡例と結合次数1/2/3の視覚区別。PAN/NBRのorder3をorder2にしない。nitrile直線性は④検証対象 |
| V4 | O/Nとcarbonyl/ether/ester/amideの局所接続を確認。主鎖のO/Nと水の原子を混同させない |
| V5 | 由来の異なるsource残基を局所で対比。凡例/文字等と併用。source色を元素色そのものと混同させず、全体組成やCRU境界は生成しない |
| V6 | source/実生成後/byproductを区別する段階比較。変化前のedgeを完成Sampleに重ねて現存edgeに見せない |
| V7 | 残存C=Cを主鎖/芳香環で区別。曲がりや色だけをcis/trans判定根拠にしない |
| V8 | PF実2環片と独立図鑑networkを別図・別説明・別identityで提示。能力と形成済みを分離。L2留保を保護者向けに明示 |

## 14. Evidence and validation

化学証拠keyはTask① §13のS1–S15を継承し、教育マトリクスがroute別S1 link、S2/S3のtransform family、Task①行を指定する。IUPAC参照は用語のみで、独自の実装グラフを科学認証するものではない。

再現検証: マトリクスAppendix AのNode codeをrepository rootで実行。25 ID組、目標、必須field、数値・route family、V、relative link、documentation-only scopeを確認する。既存route authorityとCore fixturesを限定実行する。独立レビューは別reviewerが全25×M1–M9と9ケースを監査し、実結果をPRに残す。

| 検証 | 状態 / 意味 |
|---|---|
| マトリクスAppendix A | PASS: production 25組とset一致、重複0、主/副目標・15field・taxonomy・四evidence classes・Task①数値/family・L1/L2・9ケース・相対link・文書限定scope |
| 既存route/Core fixture | PASS: `node --test tests/polymerization-routes.test.mjs tests/reaction-lab-polymerization-fixtures.test.mjs`、29 tests、0 fail、0 skip。既存実装の原子保存/evidenceを照合する範囲 |
| Repository hygiene / diff | PASS: `node scripts/check-repository-hygiene.mjs`、774 files、137 reachable production modules、0 warnings; `git diff --check` |
| Offline consistency | PASS: `node scripts/build-precache.mjs --check`、353 assets; `node tests/pwa.test.mjs`。アセット再生成なし |
| 独立review / PR CI / main integration / post-merge | commit/PR/mainの実authorityをPRに記録。自己レビューを独立reviewと呼ばない |
| 新規GPU campaign / browser performance比較 | NOT_RUN locally（文書タスク）。自動既存CIを変更・再実行して成功を選ばない |
| 新視覚実装 / 児童観察 / 教育効果 | NOT_IMPLEMENTED / NOT_RUN / NOT_DEMONSTRATED。Task②受入と区別 |

Preflightでmain保護false、repository/inherited rulesets `[]`。新たなrequired gateがあれば遵守する。既存CIは変更せず全結果を報告し、原因未確認FAILは免除しない。Task②diffが文書のみで、独立した既存性能問題と証拠で確認できた場合に限り、そのFAILを残したまま文書受入との独立性を判定する。児童観察を未実施のままPASSにしたり、#345をマージ済みと記載したりしない。
