# Local finite polymer 3D — Task③ canonical visual specification

## 1. Objective and authority

本書は新Task④ geometry / Task⑤ renderer / Task⑥ acceptanceが共有する**完成外観の規範仕様**。MUSTは必須、targetは未実装の要件。Task③は設計受入であり完成renderer、科学認証、児童理解、性能の合格を意味しない。

開始source: `905ba4f1fb4a0e6d63e658a9f178ac29ad8beb49`、2026-10-19 JSTにGitHub branchとcloneの一致を確認。[Task① authority](polymer-local-fragment-task1-authority.md)、[Task①全25表](polymer-local-fragment-route-matrix.md)、[Task②教育正本](polymer-local-fragment-task2-education.md)、[Task②教育表](polymer-local-fragment-task2-education-matrix.md)を継承する。E1–E4、V0–V8、M1–M9、C01–C09の意味・学習分類を再設計しない。

PR #346/#347/#349はMERGED。独立[PR #345](https://github.com/miyatayuuma/molecule-craft/pull/345)はOPEN/unmerged、head `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`。そのC9 footer/resize修復は本sourceにない。Task⑤は開始時に再照合し、修復を逆行させない。本タスクは#345へ介入しない。

相互に必要な正本: [全25 visual matrix](polymer-local-fragment-task3-visual-matrix.md)、[evidence manifest](polymer-local-fragment-task3-visual-evidence.md)。仕様値は合否を固定する設計判断であり、実機・児童試験で最適値と実証したものではない。添付されていない旧参考画像は再構成しない。「有限鎖の自然な奥行きを持つball-and-stick」を採用し、原子数の増加で外観を近づけない。

## 2. Current appearance and gap audit

source owner: [viewer](../../src/reaction-lab-viewer.js) `createInstance`, `updatePolymerBondVisuals`, `fitFinitePolymerToWorkArea`, `resetPolymerView`, `resize`; [layout](../../src/polymer-fragment-3d-layout.js) `angleFor`, `relaxGeometry`; [fallback](../../src/reaction-lab-polymer-presentation.js); [chemistry](../../src/chemistry.js) `ELEMENTS`, `modelAtomRadius`; [styles](../../styles.css) `.reaction-lab-*`; [browser test](../../tests/reaction-lab-polymer-browser.test.mjs)。evidenceの画像は現mainの実ブラウザ成果を再利用したBASELINE_CURRENT、Task③の新撮影ではない。

分類は項目の異なる主張へ適用する。CURRENT_OKは限定した既存挙動、VERIFIED_DEFECTはsourceまたは画像で直接確認した不適合、VISUAL_GAPは目標との差、IMPLEMENTATION_TARGETは追加仕様、NOT_VERIFIEDは未検証。見た目だけから化学欠陥を断定しない。

| 項目 | 現行の事実 / 分類 | 完成目標・担当 | 受入 |
|---|---|---|---|
| 原子球・相対サイズ | `.72×ELEMENTS.radius`; H .2304、C .3312 world。球の保持CURRENT_OK | 基本半径維持、画面寸法の不足をfit/局所viewで解消⑤ | A01/A03 |
| stick形状 | radius .038、8角、中心間長。細線の視認は画像で限定的VISUAL_GAP | single .050、multiple .038、12角、球内へ接続⑤ | A04 |
| 単/二/三重 | order>=2が2lane、PAN/NBR order3も2lane。L1 VERIFIED_DEFECT（source） | 1/2/3本を厳密に区別⑤ | A04、C07、S10 |
| 元素色/背景 | 現行C/H/Oの分離は取得画像でCURRENT_OK。全元素・色覚条件NOT_VERIFIED | 色維持＋文字凡例/選択表示⑤ | A05 |
| 材質/ライト | roughness .32/metalness .08、hemisphere 2.2/key 3。陰影ありCURRENT_OK、全角度NOT_VERIFIED | 数値維持、白飛び/暗部と輪郭の検査⑤ | A06 |
| 自己重なり | PS/nylon画像で複数原子・stickが重なるVISUAL_GAP。画像から3D衝突とはいえない | 空間重なり④、投影遮蔽回復⑤ | A07 |
| 環と主鎖 | graphは別、PS/PETが画像上で容易に全経路をたどれるかNOT_VERIFIED | 実cycle集合と接続を局所view/注釈⑤、平面④ | V2/C03/C04 |
| H/置換基密集 | 全H保持CURRENT_OK、密集時の全識別NOT_VERIFIED | H/F/Clを消さず局所到達⑤、衝突④ | A03/A07/S11 |
| framing/初期角 | Euler (.34,-.28,.035)、sphere fit。mobile画像の空白が大きいVISUAL_GAP | tight sphere-enclosing box fit、決定的姿勢探索⑤ | A01/A02 |
| Mobile/Desktopサイズ | 390×844と一部1280×900実画像あり。他条件NOT_VERIFIED | 360×780、390×844、1280×800で全25⑤/⑥ | A01/A03 |
| orbit/pinch/wheel/reset | source実装CURRENT_OK。今回新しいpointer試験はNOT_VERIFIED | 既存所有権＋局所pivot、再現reset⑤ | A08/A09 |
| UI/説明との競合 | 画像に小さい9px文とoverlayありVISUAL_GAP。全状態の重なりNOT_VERIFIED | 凡例/説明14px、44px操作、DOM計測safe region⑤ | A10/A11 |
| resize | sourceはunconditional setSize、ready fitは再実行しない。C9修復未統合の事実CURRENT_OK（欠陥修正済みという意味ではない） | 実寸/DPR変化に再fit、completion安定枠⑤ | A12/性能契約 |
| source/前後/PF比較 | 必要な全UIはないIMPLEMENTATION_TARGET | §9の別状態/identity⑤ | V5/V6/V8 |

L2はPF位置選択の化学評価未了。外観で修復・認証しない。現main runのRAF不足/Stage B FAILはevidenceに別記し、VISUAL_GAPの原因と推定しない。

## 3. Chemical graph and coordinate boundary

`PolymerSample.fragment`をimmutable authorityとする。全atom index/ID/element/charge、bond endpoint/order、origin tuple `(instanceId,sourceAtomIndex)`、sample/route/polymer/batch identityを保持する。H、置換基、環、現末端を表示から除外しない。source partitionで水へ移った原子を主fragmentに戻さない。annotationは別レイヤーで、実meshの数や反応グラフを変えない。

continuation metadataは原子ではない。端にキャップ、延長stick、ghost鎖を作らない。18 chainのportsと6縮合/PFのports0を維持。実4投入を完全CRU4個としない。PFの二環/CH₂/OHを四環networkに置換しない。origin quotientで主鎖/branchを推定しない（PFの移動Hを含むX4とL3を区別）。

座標は例示的配座。角度/長さ/環/立体重なりの修正は④、球半径・stick装飾・画角・照明・注釈は⑤。描画半径の大小は共有結合半径/van der Waals半径の測定ではない。aromaticの交互order1/2は記録graphの描画規約であり、固定した電子局在や唯一のKekulé実体の証明ではない。

## 4. Units and fixed design tokens

| 記号/単位 | 使用領域・変換 |
|---|---|
| chemistry Å | 原子間距離を議論する物理単位。Stage Aの明示換算は `.78 world / Å`。本layoutのsource比から得る`geometryScale`は別診断値で固定Å校正ではない |
| layout / world | layout XYZを同じworld基準へ渡す。group scale `s`が表示上の倍率。距離データは改変せず、半径/offsetにもsを掛ける |
| CSS px | DOM、safe region、投影寸法、操作領域。DPRに依存しない合否単位 |
| device px | drawing buffer / raster。`round(CSS dimension × capped DPR)`。CSS閾値をDPR倍しない |
| normalized | `x/W`, `y/H` またはNDC [-1,1]。占有率はsafe rectangle寸法に対する比率、全viewport比ではない |

### Atom spheres

半径は現行meshをsourceで実測した値を維持し、全25投影fixtureで寸法を比較した（evidence §3）。選択の有無で球自体を膨張させない。

| 元素 | 色 sRGB | radius world（group scale前） | Cに対する比率 | 規則 |
|---|---|---:|---:|---|
| H | `#f8fafc` | .2304 | .695652 | explicit H、非表示化しない |
| C | `#64748b` | .3312 | 1 | 主鎖でも側基でも同色 |
| O | `#ef4444` | .3024 | .913043 | water Oと主鎖Oも色は同じ、所属を別ラベル |
| N | `#3b82f6` | .3168 | .956522 | CN/amideでも同色 |
| F | `#22c55e` | .2880 | .869565 | Clと文字で区別 |
| Cl | `#16a34a` | .3456 | 1.043478 | Fと色だけで区別しない |
| P | `#f97316` | .3528 | 1.065217 | 現25最終fragmentにはなし、通常分子/比較を保護する予備値 |
| S | `#eab308` | .3600 | 1.086957 | 同上。加硫Sを実ゴムSampleへ足す許可ではない |

実25で使う元素集合はC/H/O/N/F/Cl。未知元素をCに置換せず、適用範囲外の明示diagnosticと既存安全表示へ返す。数値許容差は半径±1e-6 world、色RGB各成分±1/255（材質入力）。lighting後の画素をこのRGBに一致させる試験ではない。

材質は`MeshStandardMaterial`、roughness .32 ±.01 / metalness .08 ±.01 / opacity1 / transparent=false / depthTest=true / depthWrite=true。現画像で球面陰影が成立しているため、未比較の光沢案へ変更しない。通常状態はemissive0、bloom/発光/DOF/fogなし。mesh tessellationは球24×16、stick12 radial segments（現16×12/8からのtarget）。投影半径50pxの球の経度sagitta `50(1−cos(π/24))=.428px`、緯度方向 `50(1−cos(π/16))=.961px`を根拠にoverview輪郭誤差1 CSS px、local2 CSS pxを許容。近接拡大で超える場合は生成時に必要segment数 `ceil(π/acos(1−ε/r_px))`へ上げる。orbit中の再生成は禁止、上限/資源量を記録してstrict gateで評価する。

選択は球色/opacityを変えず、球外側の2 CSS px実線輪郭＋「N・窒素 / atom index」の固定パネル。非選択球もopaque1のまま。annotation描画とgraph mesh countは別々に数える。色覚対応は常設「C 炭素」「H 水素」等の球swatch+文字凡例、選択記号、接続の本数。全原子に文字を重ねず1対象/1短文とする。

## 5. Single / double / triple bond grammar

| order | 本数 | 各lane radius world | 中心軸からのoffset world | 最小局所画面条件 |
|---|---:|---:|---|---|
| 1 | 1 | .050 | 0 | 可視線幅≥1.5 CSS px、球外の連続長≥8 CSS px |
| 2 | 2 | .038 | −.080, +.080 | 各幅≥1.5px、lane間の背景gap≥1px、並行可視長≥8px |
| 3 | 3 | .038 | −.160, 0, +.160 | 各幅≥1.5px、**二つ**のgap各≥1px、3本が同時に≥8px |

radius/offset許容±1e-6 world。order3を2本や太い1本で代用しない。PANは4本、NBRは1本の実C≡Nの全対象が条件を満たす局所観察状態を持つ。nitrileの直線性は④、3laneは⑤が別々に合否判定する。

`q=f*s/depth` CSS px / local worldの局所倍率とする。q=20ならsingle幅2.00px、multiple幅1.52px、隣接gap `( .160−2×.038 )×20=1.68px`、triple外幅7.92px。現radius .038 singleでは同倍率で1.52pxだが、overviewの細線に余裕を持たせるためsingleのみ.050。これは現行world寸法と画素予算の比較に基づく設計値で、結合長の変更ではない。q≥20は局所条件の必要な倍率の目安であり遮蔽/短縮の十分条件ではない。

axis `u=(B−A)/|B−A|`、camera forwardをgroup localへ戻したvに対しside `normalize(cross(u,v))`。end-onで長さが短い場合は前フレームのsideを平行輸送し、退化時は|u·axis|最小の座標軸を使う。符号は前frameとdot≥0を保つ。orbitでsideとcylinder transformだけ更新し、laneを再allocateしない。実結合の軸や原子位置をcameraへ曲げない。完全end-onでは本数観察を要求せず、選択パネルの次数と中立凡例を示し、回転後に上表を満たすことを要求する。

各laneのoffsetをo、球半径をrA/rBとし、球中心から軸方向の露出始端は `max(0,sqrt(max(0,rA²−o²))−.01)`、終端も同式で球内へ.01 world埋める。laneは球と接続し、球外の空隙>1 CSS pxはFAIL。長さ≤両埋込距離ならgeometry診断を表示し、逆向き/負長円柱を作らない。強調でfake edgeを足さない。色は全次数`#b8d1de`、roughness.50 ±.01、metalness0、opaque1。次数を色/太さだけで符号化しない。

芳香環はsource graphの交互1/2を同じgrammarで描く。ringの注釈は環全体を囲む別線＋「輪」。芳香性の円を新しい共有結合として足したり、SBRの残存diene C=Cと同じ「元の二重結合」説明へまとめない。

## 6. Lighting, depth and spatial legibility

scene背景`#0a1724`、sRGB output、toneMappingなし（既定NoToneMapping）、exposure1。Hemisphere sky`#d9efff`/ground`#162231` intensity2.2 ±.02、Directional白 intensity3.0 ±.02、world位置(3,6,7)。shadow map/postprocessなし。現sourceと取得画像に由来する保持値であり、未計測の照明改善を成果としない。

A06では指定球の可視diskを背景/注釈と分離してPNGを読む。選択対象の輪郭のうち背景へ露出する部分の75%以上で、隣接2px帯との相対輝度差≥.05（linear sRGB）、球diskの白clip（RGB全て≥250）が30%以下（白いHの素材色自体は例外、Hも輪郭差は必須）。球の暗部が背景と完全に同化し輪郭追跡不能ならFAIL。閾値は現球/背景を保持したまま陰影と識別を検査する設計予算、知覚一般の科学的限界値ではない。照明入力/撮影条件を固定する。全角度の自動画素比較だけで教育PASSとしない。

自然な鎖は、局所化学角・実ring・残存多重結合に矛盾せず、回転で異なる奥行きが観測できる例示的配置。単にZに乱数やsineを足して自然さとしない。④は全25でbond/angle/nitrile/ring/stericの診断を出し、現G0–G7 gateを下限として保持。新しい化学閾値/検証根拠は④が正本へ記録する。③は力場や唯一の配座を発明しない。

初期viewで必須なのは、全投影範囲と実端、少なくとも一つの主鎖経路区間、case主目標の局所特徴を探し始められること。全edge/Hが一画角で非遮蔽であることは要求しない。各routeの指定atom/bond全体はA07の有限view集合で回復可能でなければならない。原子削除、透視表示、z-test無効、opacityによる隠蔽は不可。局所選択の外にある原子はcamera cropしてよいがmeshを削除せず、「一部を拡大中」と示しresetで全体へ戻す。

## 7. Camera, safe regions and deterministic initial fit

### Camera and layout budget

Perspective FOV vertical42° ±.01°、aspect=実canvas CSS W/H。既存Lab camera位置/target/距離d（7–64 world）を完成観察のために変更せず、有限Sample groupのposition/quaternion/uniform scaleでfitする。d=15は解析fixtureの条件であり、全FEEDのd固定指示ではない。camera world normal/right/up基底を使い、target/pivotは模型の**全atom＋visual radiusのAABB中心**（質量中心やsource個数平均ではない）。group再中心化は座標の表示変換で、graph/原子相対距離を変えない。

near .1、far500を維持し、全bounding sphereについてdepth−sr>.2、depth+sr<500をfit制約に加える。意図zoomでもnearを横断させない。d範囲で収まらない入力は安全な警告＋reset、欠落atomの黙認なし。

| viewport CSS | layout target最小canvas W×H CSS | DOM budgetの意味 | overlay保守枠のsafe例 (L,T,R,B) |
|---|---|---|---|
| 360×780 | 338×430 | 左右11px、canvas以外の高さ計350px以下 | (12,74,260,348) →248×274 |
| 390×844 | 368×494 | 左右11px、canvas以外350px以下 | (12,74,290,412) →278×338 |
| 1280×800 | 856×420 | dialog幅900内のpadding/border、非canvas380px以下 | (12,74,778,338) →766×264 |

上表は**将来のDOM予算**で実測済み画面寸法ではない。文字14px、44px操作を含むfooter/説明/比較枠の最大高さをFEED時に予約する。名前は2行まで折返し、長文は明示展開するスクロール枠へ。canvasを縮めて上表より小さくする場合はUIを整理し、模型/文字基準を緩めない。safe-area insetがある実機ではviewport usable寸法を差し引いて同計算し、追加条件として記録する。

### Actual safe rectangle S

canvas client rectを原点にする。実表示overlayのDOMRect（LIGHT、HEAT、pH、凡例、ヒント、注釈、開いた操作枠）を集め、8px膨張させる。base `[12,W−12]×[12,H−12]`内で、overlayの各edgeを候補境界とするaxis-aligned空矩形を列挙する。幅≥160px/高さ≥160px、全overlayと交差面積0の矩形だけ残し、面積最大→中心がcanvas中心に近い→left/top小の順で一意選択する。全幅を一律にpH幅だけ切る必要はない。上表のsafe例はこの計算より厳しい**保守的な解析専用矩形**。実SはDOMを測って決め、例をhard-codeしない。Sが存在しなければUI layout FAIL、縮小模型で回避しない。

canvas外のfooter/headerはSに入れないがviewport内の可読性/操作を検査する。模型の初期/reset投影とUIの交差0、UI最小余白8px（S内側の模型余白と合算）、canvas端12px以上。丸角の四隅に依存するfitを避ける。

### Fit calculation and orientation search

`f=H/(2 tan(FOV/2))` CSS px/world at depth1。初期候補Euler XYZは `(.34+p,−.28+y,.035+r)`、p∈{−π/6,0,+π/6}、y∈{0,π/4,…,7π/4}、r∈{0,π/2}の48通り。順序はr外→y→p内、同点は先候補。これは外観の例示姿勢でtacticityやcis/transを付与しない。cameraでなくgroupを回す。

各候補でsphereを包む投影矩形を計算する。camera空間中心 `(x_i,y_i,z_i)`、前方depth `D_i>0`、球半径 `ρ_i=s*r_i`。中心 `X_i=W/2+f*x_i/D_i`, `Y_i=H/2−f*y_i/D_i`。半径の保守上限は `R_i=f*ρ_i/(D_i−ρ_i)`、off-axisではこの近似だけで包含を保証せず、**全fit候補の合否と最終検証は必ず**球の外接cubeの8頂点を投影しその全点を包む（近似中心±Rだけでoff-axis完全包含を断定しない）。stickのoffset/radiusを含むcylinder boundも同様に加える。

S中心へcamera right/up方向にgroupを移動し、binary search32回で全boundがS内かつclipping条件を満たす最大sを探索する。初期探索upper=8、まだfitするなら2倍して失敗まで（上限64/32回、超えれば明示diagnostic）。得たsに.92を掛けて8%線形余裕を取る。translationでbound中心がS中心へ一致するよう反復（最大8回、誤差≤1px）し、各再調整後にboundを再検査する。球中心だけのAABBや、古いcanvas寸法のSを使用しない。

候補の選択は(1)全boundsと初期必須対象を満たすもの、(2) `min_i(f*s/D_i)`最大、(3)初期主対象の非遮蔽edge数最大、(4)規定順。③解析fixtureは(2)までの寸法検算であり、(1)のraster遮蔽/atom roleと(3)は⑤/⑥実画面で検証する。48候補で主特徴が見えなければ同gridのpitch±π/3を追加し、結果と理由を記録。勝手なroute別手調整値を保存せず、決定的resolverとして検証する。

初期占有率 `max(projected_width/S.width, projected_height/S.height)` は.70–.94（±.01測定許容）。全体fitと主特徴を両立できないなら④/⑤の不適合であり、原子を削除して満たさない。姿勢探索はcompletion前に一度、resizeで一度。orbit RAF毎には行わない。解析では全25×3の同範囲占有を確認したが、完成DOM/遮蔽のPASSではない。

## 8. Orbit, zoom, focus, reset and resize contract

| 操作/状態 | Target挙動 | 再現手順・許容差 |
|---|---|---|
| orbit | readyでcanvas dragをsample groupへ。yaw/pitch各`.008 rad/CSS px`、全方位を許可、auto spin/inertiaなし | 100px水平dragでyaw .8rad ±.02、垂直も同様。q normalize、graph digest不変 |
| gesture ownership | 残存real monomerのhitは従来dockingが優先。sample観察dragでcommitしない。UI pointerはcanvasへ漏らさない | UI上/monomer上/空白/模型上の4開始点。cancel/blur/closeでcaptureとlockを解除 |
| tap selection | drag閾値6px、tap≤250ms。実visible meshのraycast、finger候補半径22pxまで | 複数候補なら元素/index一覧で選択、隠れたatomへ勝手に貫通選択しない。6px超で選択せずorbit |
| pinch | 2pointer距離比でuniform group倍率、回転と同時解釈しない | 初距離80→120pxでzoom比1.5 ±.02、指を1本離しても飛ばない |
| wheel | `z←z*exp(−deltaY_px*.001)`、line=16px/page=Hでnormalize | −200 CSS pxでe^.2倍率 ±.01、UI scroll上ではzoomしない |
| global zoom | overview fit倍率を1としてz min .72、maxはnear制約と局所必要倍率から算定 | lowerで模型縮小、resetは1。maxは `min(8, (d−.3)/(1.12*s_fit*R))`、Rはpivotから全sphere/cylinderを包む半径。max<1なら初期fit失敗 |
| local focus | 任意の**ユーザー選択**atom/group/bondに「くわしく」。pivotは選択集合AABB中心へ、graph/geometryは保持 | selected近傍＋1結合shellで再fitしq≥20とA03/A04を満たす局所view、他部分はcrop可。近傍球もnearを通過させない全graph depth検査必須。無理ならmodel回転/scale減で解消し達成不能はFAIL |
| reset | 同じcanvas/graphで初期S、候補orientation、group位置/scale、zoom1、local focus解除。注釈も初期offへ | 2回連続resetで各atom投影中心差≤1px、scale相対≤1e-6、q角差≤1e-5rad（qと−q同一扱い） |
| close/reopen | 同じviewportならpose/zoom/選択状態を保持、GPU resourcesはsuspend/dispose→同graph再構築 | atom投影中心差≤1px、sampleId/graph/origin不変。閉じている間のresizeは次行 |
| resize/DPR | 同frameでCSS寸法をまとめ、bufferの実寸/DPR変更時だけsetSize/setPixelRatio | overviewは新Sに再fit。ユーザーlocal/zoomはorientation/選択を保持しnear clamp、全体へ戻す明示resetを残す。close中に変わった場合reopenで同規則 |

zoomの最大値を上げるだけで局所識別が達成したとしない。球が他球で隠れる場合は回転してA07を実施する。local focus UIは将来実装であり現行にあるとの記述ではない。normal/reducedとも最終静止pose・操作結果は同一、reducedはcompletion250ms、normal650ms。ready後のresetは両方即時、点滅・自動回転なし。completion中のgestureは既存lockを保持。

DPRは`min(max(devicePixelRatio,1),2)`、buffer各軸round誤差≤1device px。DPR1と2、実機DPR>2でcapを確認。CSS画面寸法・受入値を変更しない。CSSサイズかcappedDPRが不変の同一bufferへの再代入は0回、実サイズ変化はcoalesceして1回/RAF以下。completion footer変化によるresize0回を⑤の構造契約とする。#345最新修復との整合が前提。

## 9. Annotation, evidence and comparison states

初期は`OVERVIEW_NEUTRAL`、元素/結合の中立凡例と「ゲームでつないだ短い部分。形は一例」を表示。学習主対象を自動色付けしない。annotation状態はgraph別のread-only `{sampleId, atomIndices, bondIndices, originTuples, kind}`。source強調は元素のfillを変えず、2px破線外枠＋番号/原料名、backbone/side/ringは2px実線外枠＋文字ラベル。最大1主対象、2副対象は別段階。leaderは1px破線で端に小さい四角、stickと別形状、原子間の共有結合を模倣しない。

UI状態遷移は `OVERVIEW_NEUTRAL ↔ SELECTED ↔ LOCAL_FOCUS`、別の`COMPARE_BEFORE ↔ COMPARE_AFTER ↔ COMPARE_BYPRODUCT`、`CONCEPT_SEPARATE`。戻る/resetで同Sampleのoverview、別Sampleに変えない。比較枠は最大状態の高さをFEED時予約しcompletion中にcanvas寸法を変えない。比較ボタンは「原料」「できた模型」「別にできた水」、概念は別題「しくみの説明」。actual source/after/waterを同じcanvasへ重畳しない。beforeとbyproductは実source/partitionのreadonly snapshotと明示し、合成物として新登録しない。

source snapshotは同batchの原子originへ照合し、commit差分のbroken/formed/order-changeとfinal graphを別に記録。数値atom indexの反応前後継続を仮定しない。waterへ属するtupleはafter主fragmentに存在しないことをassert。比較のためのsource geometryは元snapshot、future rebuildでも実source graphを使いSVGを代入しない。未取得の前状態を推測して表示せず「比較データなし」とし、該当V6をNOT_READY/FAILにする。

PFの`CONCEPT_SEPARATE`は図鑑の独立4環/3bridge motif、heading「網目のしくみを説明する模式図」、実Sample IDを付けない。実2環viewは「今回ゲームでつないだ部分」。保護者用に「このゲームの結合位置は化学的な評価が未完了（L2）」、子どもにortho/paraの正解問題を出さない。textだけで分離せずstate/identity/atom setをテストする。

色以外の選択情報、14px以上の本文/凡例（line-height≥1.4）、UI contrast≥4.5:1（通常文字）、44×44px以上の全操作hitbox、隣接hitbox gap≥8pxを目標とする。これはpixel予算として固定し、実児童の操作能力を実証した数値と称さない。旧9pxを維持してcanvasを確保しない。凡例は使用元素だけ、折返し可、操作領域を増やして模型と重ねない。説明/比較スクロールはDOM内で所有しcanvas gestureと分離する。

## 10. V0–V8 concrete visual acceptance

全行の対象indexはmatrixとfixture selectorで解決する。C01–C09は教育正本と同じ観察要求。以下のPASSは技術的視覚受入で、児童採点はTask②protocol別途。

| V | 対象・evidence / 初期と追加操作 | 表現・非色覚手掛かり / 禁止内容 | 責務 / Task⑥ PASS・fixture |
|---|---|---|---|
| V0 | 全fragmentと実末端/ports根拠。初期/resetで全範囲、詳細はorbit/focus | 全atom、実stick、短い例示注記、reset。ghost端/H cap禁止 | ④有限座標/ID、⑤fit操作。A01–A03/A08–A12、全25。C01/全routeのoverviewとreset画像 |
| V1 | 反応部位を通るsource内経路＋実inter-unit結合、側基接合。PPのmethyl、PIB二methyl等 | 主鎖/側基/接点を選択後別ラベル/輪郭、初期は中立。raw degree/画面左右で分類しない | ④role→tuple→final index、⑤注釈。A07で主鎖区間と側基/接点が同時に回復。C02、matrixのV1全行 |
| V2 | source aromaticCyclesと実edge、PS側環/PET二側接続/PF実二環 | 6頂点/6edgeを局所viewで一周。PS付着1、PET両側、PFはL2留保。環を切る/主鎖全体の環と称す不可 | ④ring geometry、⑤環集合/接続表示。A07とC03/C04/C09、環内1/2をA04検査。V2全行 |
| V3 | C/H/O/N/F/Clとorder別実edge。初期中立凡例、PAN/NBRで局所zoom/回転 | 元素symbol/name、1/2/3線の中立凡例、選択次数。L1の二laneはFAIL、色/太さ代用不可 | ④nitrile角、⑤1/2/3grammar。A03–A06、C07/S10、V3全行＋全25使用元素/次数 |
| V4 | 実O/N、C=O、C–O–C、C(=O)–O/N、実端基。waterとは別集合 | 選択group名＋原子symbol/結合、局所の近傍も表示。O全部を水としない | ④官能基角/長さ、⑤局所view。C04/C05/C06、各link集合全部をA07で回復、V4全行 |
| V5 | final origin tuplesとsource sequence、二種原料/局所比較。初期は原料番号凡例のみ、比較段階で一原料選択 | fill=元素、破線枠/①②原料名=由来、実局所列text。全体比/CRU周期の創作禁止 | ④tuple対応、⑤COMPARE/注釈。C04/C05/C08、全source tupleの表示一致100%、V5全行 |
| V6 | actual before graph/commit diff、after fragment、水partition、PEO ringOpenings | 原料/できた模型/別waterの状態切替、各heading/identity。broken edgeのafter重畳/原子二重計上禁止 | ④before/after座標を混同しない、⑤snapshot比較。C01副/C04/C05/C06、A13、V6全行。未UIはNOT_IMPLEMENTED |
| V7 | ring外の残存diene C=Cとring内order2を別集合 | 選択ラベル「鎖の二重結合」「輪の中の結合」、本数も同時確認。cis/transやbulk分布断定禁止 | ④diene保存、⑤ring外selector。C08/S10、A04/A07、V7全行 |
| V8 | PF actual二環/CH₂/hydroxymethyl/1water対independent network motif | 別題/別state/別identity、L2保護者注記。実3arm junction・実4環を生成しない | ④実graph保持、⑤CONCEPT_SEPARATE。C09/A14で実2環と独立4環/3bridgeを別oracle照合。PFのみ |

適用routeの完全一覧はmatrix各行のV集合を正本とする。全routeはV0とV3の基本grammarを共通要件として受け、Task②で列挙した各Vを削除しない。Task②主/副目標は変更しない。

## 11. Reference cases and stress cases

[visual matrix §Representative cases](polymer-local-fragment-task3-visual-matrix.md#representative-cases-c01c09)のC01–C09を規範fixtureとする。初期条件は共通OVERVIEW_NEUTRAL、同一graph/viewport/DPR/motionからreset、技術測定時だけ明示annotationを開く。観察者が正答集合を強調してから児童を採点すればH2であり、視覚合格を理解合格としない。

全25の個別riskに加えS10=NBRの1/2/3、S11=PTFEのF shell、S12=PIB二methyl、S13=Nylon-6,6長片、S14=PCTFEのF/Cl、S15=VDF–HFP CF₃、S16=PAA酸OH/PLA methylを検証する。架橋/branch模型を足して代表数を埋めない。

## 12. Objective visual acceptance thresholds

測定前提: exact graph/route、renderer SHA、viewport、実canvas/S、DPR、motion、font-ready、state、quaternion/scale/positionをJSONで保存。matrixの全対象をfinal index/tupleへ照合する。screen boundsは全sphere/cylinderの外接立方体投影、raster識別は実PNG、視認対象の対応はID mask（test-only）を併用。mask画像自体をproduction画質画像として比較しない。

| ID | 条件・単位・手順 | PASS / FAIL |
|---|---|---|
| A01 | 初期/resetで全mesh boundをSへ投影、UI rectも保存 | 全atom/bondあり、S外≤1 CSS px測定誤差、near/far適合。1pxを意図欠落許容に使わない |
| A02 | projected full boundsの占有率、bound中心 | .70–.94 ±.01、中心とS中心差≤1px。旧画像の小ささをtarget合格としない |
| A03 | sphere silhouette diameterをprojectionとPNGで照合 | 遮蔽前の投影silhouette径がoverview H≥4px/他≥6px、local H≥6px/他≥10px（誤差.5px）。初期全atomの非遮蔽は要求せず、局所到達状態で各atomの投影diskの60%以上が見えるviewを対象ごとに持つ |
| A04 | exposed cylinder中央区間、法線断面をPNGで読む。50%coverage以上のlane連続画素と背景gap、depth maskで別mesh遮蔽除外 | §5の1.5px幅/1px gap/8px並行長を**全指定edge**で到達。誤差.25px、orderと本数一致100%。局所で3本を数えられなければL1残存 |
| A05 | 元素凡例/選択symbol、色をgrayscale化して同定導線を監査 | 使用元素凡例漏れ0、selected symbol/名前/atom index一致100%、F/Clも区別。色だけの正答誘導FAIL |
| A06 | §6のlight/material入力、球輪郭・明暗pixel検査 | 入力許容差内、輪郭75%/輝度差.05/白clip30%条件。raster/GPU差は元画像を保存して判断、無理由waiver禁止 |
| A07 | 下記有限view grid＋選択local viewで、要求atom/bondの可視maskを集計 | 全対象を少なくとも1viewでA03/A04回復。ring六edgeは1局所viewで同時追跡、側基/接合/隣接主鎖も1viewで同時識別。画面上の近接だけを結合扱いしない |
| A08 | drag/touch/pinch/wheel/resetの実イベント、前後pose/digest | §8値、no chemistry commit、pointer lock解除。CSS button.clickだけでpointer試験を代用しない |
| A09 | orbit/zoom→reset2回、close/reopen。diff値を保存 | §8の1px/1e-6/1e-5rad、graph/sample不変、GPU resources不必要増加0 |
| A10 | DOM computed font/line height/color、overflow | 本文/凡例≥14px/1.4、文字contrast≥4.5:1、切れ/重なり0、viewport横overflow≤1px |
| A11 | visible control全件のhitbox/elementFromPointをgrid確認 | ≥44×44px、gap≥8px、説明scroll/canvas/docking所有権競合0。close/resetも対象 |
| A12 | 360→390→1280→360、DPR1→2、close中変更を各1回 | 新Sでoverview A01/A02、localは§8保持、buffer誤差≤1device px、same-buffer再代入0 |
| A13 | V6 stateごとにsource/final/byproduct IDs、tuple partition、headingを照合 | 必須source/after/water0/1/3の対応100%、water原子二重計上0、PEO前環/後μ0、原子消失説明0 |
| A14 | PFのactual/CONCEPT_SEPARATEを往復、stateとgraph digest検査 | actual μ2/二環/1bridge、概念4環/3bridge別identity、L2注記あり、置換/実junction創作0 |
| A15 | education matrixとvisual matrixをID組で比較 | 25組完全一致、V0–V8/C01–C09全coverage、M1–M9反証レビュー、未実施をPASSとしない |

遮蔽回復gridはcameraを固定し、camera up軸のyaw `{0,45,…315}°` ×camera right軸のpitch `{−60,−30,0,30,60}°`をsample groupへ適用する40views。quaternionは `q = q_pitch * q_yaw * q_reset`（rightmost先、各step normalize）、roll追加0。各viewは同fit倍率、要求局所をユーザー選択してfocusした後も同gridを評価する。各atomの可視投影disk比≥.60、各bondの露出区間はA04、輪郭/文字はA06/A10で採点。別viewでそれぞれ回復できても、同時比較要件（環・接合等）を満たさなければFAIL。testは到達viewのquaternion/selection/zoomを保存し、実pointerでその到達を再現（q角差≤.02rad/zoom比差≤.02）。gridは良い写真だけを選ぶ比較ではなく、全対象coverageを求める固定探索予算。未達の対象IDを列挙し④/⑤へ戻す。

## 13. Screenshot evidence protocol

種別を必ず区別する: BASELINE_CURRENT=実現行画面、TARGET_REFERENCE=設計見本、FUTURE_ACCEPTANCE=同条件比較予定（未撮影ならNOT_CAPTURED）、NOT_CAPTURED=理由と担当。解析projectionは画像でなくANALYTICAL_PROJECTION_NOT_SCREENSHOT。別条件のPNGを厳密差分に使わない。

canonical filenameは `{case-or-route}-{viewportW}x{viewportH}-dpr{n}-{normal|reduced}-{state}.png`。sidecarはsourceSHA、runtime blobs/digest、route/sample/batch、full input fixture hash、graph digest、target index/tuple sets、font/browser/revision/OS/GPU flags、actualcanvas/S/overlays、DPR/cap、motion、state、camera matrix/position/target/FOV/near/far、group quaternion/scale/position、操作列、capture timestamp/hash、A results。NAを0で埋めない。旧baselineにないfieldはUNKNOWNとして再撮影要求。

all25: 3viewport×2motion×DPR1でOVERVIEW_NEUTRAL/resetと各V必要state、局所coverage witnessを保存。代表9とS10–S16はDPR2も同条件。全stateの組合せを無目的に増やさず、V6 before/after/waterとV8 conceptを追加。physical mobileは別device証拠、emulationで代替したとしない。性能測定window中はscreenshot/readback/bounds scanを行わず、静止後にcaptureする。画像撮影用RAFをsynthetic性能frameに混ぜない。

## 14. Geometry / renderer ownership and non-regression

| Task | 実装/証拠の責任・開始点 |
|---|---|
| ④ | 最新mainと①②③を読む。実Core fixture＋source poseからXYZ、atom origin対応、G0–G7、nitrile局所直線/環/官能基/steric/失敗fallbackを改善。matrixのsemantic targetを検証済みfinal setsへ変換し、graph digest不変を示す。L2は座標で修復不可 |
| ⑤ | ④と本tokens/fit/statesを採用。L1解消、全atom/stick描画、凡例/注釈/比較/局所focus、gesture、DOM safe fit/resize/DPR、GPU lifetimeを完成。最新#345をreconcile。chemical selectorは検証済みgraphからread-onlyに受ける |
| ⑥ | 全25×全VとC/S caseの実画面・実pointer・lifecycle・保存/Collection/再FEED/Engineering/FIELD・PWA、strict性能、児童protocolの実施/未実施を個別判定。化学L2留保を無条件PASSにしない |

geometry/meshはcommitted graph変更時だけ構築。orbit/reset/focusは既存mesh transform/annotation更新、layout solve0回。resource ownership: source sphereはorigin mappingを保持して再利用、bond lanesはgraph/orderに対しpool、annotationはsample別dispose。closeはGPU geometry/material/textureとpointerを解放しgraph/poseのみ保持、reopen同graph、purgeで旧sample resource0。resource countersは何を共有/再生成したかを示し、単にtotal object数一定だけでleakなしと断定しない。

ResizeObserverはCSS実寸をcoalesce、drawing bufferの同size reset/GPU同期待機を増やさない。stage-B hotpath、固定step/workload/baseline/trials、8.333333333333334ms absolute budget、650/250ms feedback、real RAF、既存finite comparatorの閾値を保持。重いdiagnosticをproductionへ残さない。メモリ/性能は実計測し、不合格の再実行を成功選別に使わない。Task③はGPU campaignを追加しない。

## 15. Evidence, limitations and closure

取得/測定の詳細と実検証は[evidence manifest](polymer-local-fragment-task3-visual-evidence.md)、PR CI/review/main authorityはTask③ PRに記録する。mainの既存FAILを過去のTask②成功記録で上書きしない。Task③必須文書検査/独立review/merge/post-mergeが完了して初めて設計CLOSED。新renderer、比較UI、全viewport raster、physical device、児童観察はNOT_IMPLEMENTED/NOT_RUNであり後工程へ残る。
