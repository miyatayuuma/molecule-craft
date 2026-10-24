# Task⑤ PIB conflict isolation — isolated / native mismatch / BLOCKED

開始main `593ac571e4d664f7af885855352142874dd227ab`、PR #354 HEAD `c3d297fae42b4e653388b5e4ff75bdb50f02fd7c`。GitHubとremote refが一致。Draft/Open/Unmerged、inline5件はすべてresolved、開始HEADのActions runは0件。2026-10-23 22:34:24 UTCのCodex診断レビューは重大指摘なし。これは最終release reviewではない。PR #345もOpen/Unmergedのまま。

**保存MILPの矛盾は、ceil26ではbond32面積とbond34連続長、ceil27ではbond32連続長とbond34連続長に局所化した。** いずれも背景行・変数bounds・integralityを固定したグループ単位の最小矛盾集合。行単位のIISでも、真の立体配置の不可能性証明でもない。PIBはUNRESOLVED、Task⑤はBLOCKED。汎用的なfeasibility修復は未完了、候補生成・新raster・GPUは0。

[最終証明検証](polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa/certificates.json) /
[protocol](polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa/protocol.json) /
[全32診断](polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa/history.json) /
[native audit](polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa/native-audit.json.gz) /
[manifest](polymer-local-fragment-task5-evidence/recovery/pib-conflict-c3d297fa/manifest.json)

## 保存系とprovenance

入力は前回の`corrected-r1-n26-system.json.gz` / `corrected-r1-n27-system.json.gz`そのもの。再構築は行の意味を取り出すためだけに行い、60189/60313全行、10381/10397変数、全bounds・integrality・objectiveを保存系と完全一致させた。実際の診断solverには保存系の行列を渡した。

各行と各変数の元のsource line、生成site、対象atom/bond、cell、sample、ceil枝、predicate key、group/categoryを`n26-provenance.json.gz` / `n27-provenance.json.gz`へ保存。面積5条件、32/34連続長、pixel coverage、depth OR/order、floor cell、ceil枝、binary implication、rotation box/絶対値補助行を追跡できる。連続長groupはその枝の全行を含む。面積groupは集約行だけを含み、coverage/depthの背景行を削除しない。

## 固定予算と矛盾集合

solver実行前にprotocolとsource/input hashを固定。最大32回、各20秒・2000ノード、objectiveは0の診断feasibility。各枝について全系のLP緩和1回、7groupの固定順削除7回、その後残り16回で対象別coverage/depth行の削除診断。32回、solver合計249.459秒で停止。22 infeasible / 9有効な診断primal / 1 UNKNOWN。旧12枠、無効2枠、修正済み2候補枠は再実行していない。

| 枝 | 背景固定の最小矛盾group | 既知infeasibleの保存結果 | groupを1個外した証拠 |
|---|---|---|---|
| ceil26 | bond32面積 + bond34連続長 | solve7、6563行 | solve5 / solve8。全該当行・bounds・integrality残差最大1.43e-14 |
| ceil27 | bond32連続長 + bond34連続長 | solve14、60308行 | solve15 / 独立zero-delta primal。残差0 |

C30・bond33・bond34・bond35面積は両枝の上記集合に必須ではない。ceil26ではbond32連続長も不要、ceil27ではbond32面積も不要。したがってH5→bond33の面積改善だけでは、保存系のこの矛盾を解消できない。全系のLP緩和は両枝ともfeasibleだが、分数binaryを許すため整数モデルの整合性を証明しない。

ceil27の「continuity34を削除」はsolve16で20秒上限、incumbentなし。これをinfeasibleと読み替えていない。その後、**保存系のdelta=0でBoolean単調伝播だけを使い**、背景+continuity32の56810行を満たす10397変数の明示primalを構成した。全行・bounds・integrality残差0。solver呼出しなしで、この片方の削除系がfeasibleと証明できたため、最終的には両枝ともgroup-minimal。`conflicts.json`/`summary.json`はsolver終了時点の未更新の観測、`certificates.json`がこの後処理を含む最終判定である。

背景削除では、ceil26のcoreはbond32 coverage、bond32 depth、またはbond34 coverageのいずれかを外すとfeasible。C30/bond33/bond35の同種行やbond34 depthを外してもinfeasible。ceil27のcoreはbond32 coverageを外すとfeasible、bond32 depthだけの削除ではinfeasible。固定予算終了時点でceil27のbond34背景削除は未実施。これらは原因を絞る診断であり、その行を正式条件から外す修復ではない。

## Native rasterとの識別

既存12候補のlegacy4 CPU gradeを再利用し、activeモデルを同じ非ゼロ姿勢で評価した。新CPU rasterは生成していない。12枠には同じ姿勢の重複もあり、独立12姿勢の証拠とは扱わない。

| 対象 | model面積 − 保存native面積（px） | model連続長 − 保存native連続長（px） |
|---|---:|---:|
| C30 | -2〜+1 | — |
| bond32 | 0〜+3 | +0.000407〜+0.490688 |
| bond33 | -4〜-1 | proposalに連続長条件なし |
| bond34 | 0〜+2 | +0.000110〜+0.000853 |
| bond35 | 0〜+2 | proposalに連続長条件なし |

bond32は面積でもrunでも偽陽性を生む。bond33では保存nativeより1〜4画素を少なく予測する。単純に一定の不足画素を加算して全条件を保証できる誤差ではない。

最近傍の保存済みactual GPU capture `boundary-30-0`はseedからdelta `[.054539559717,.104538058990,-.083154836885]`度でbox内。保存pose/scale/fitを再構成して一致を検証し、保存maskとの画素集合差を調べた。C30/bond32/bond34/bond35で各1偽陰性、bond33はこのcaptureでは差0。偽陽性は順に1/1/2/1、全5対象のpool外可視画素は0。GPUとlegacy4 CPUの算術差を含むため、これだけで全差を局所affine誤差へ帰属させない。

特にbond32の(157,262)は保存GPU maskでもnative triangle probeでもbond32が前にある。一方、`depth:31:1056:157:262`のaffine値は **-0.118735672（1e6-scaled NDC）**、nativeでのC30−bond32 depthは **+0.774860382（同単位）**。ORのoutside枝も負で、近似モデルはこの実在するbond画素を拒否する。seed/actual双方でfront facetは同じ（bond32 triangle3、C30 triangle355）。したがって、この点の偽陰性はfacet交代だけでは説明できず、quantized interceptと非量子化局所depth勾配の混在を含むdepth近似を修復する必要がある。これがcore全体を解消するとの証明はまだない。

bond34の(224,238)は、modelのown coverageが-0.057405371px、保存native hullの内側余裕は+0.005913767px。seedではその点を覆うfacetなし、actualではtriangle18が覆う。coverage/quantization/facet出現の切替を単一affineで表す限界がある。ただしこの点を追加すれば連続長7.75pxに届く、とは主張しない。

調査対象7項目の帰結:

- H5/bond33: 保存CPU gradeの過小予測を確認。過去のH5遮蔽証拠は維持。ただし今回の最小coreにbond33面積はなく、この影だけがinfeasibilityの直接原因とはいえない。
- C35/bond34: 過去のendpoint/run遮蔽証拠を維持。今回の最近傍captureで新たなC35所有権切替を証明したわけではない。bond34 coverageのfacet出現は上記で確認。
- bond32: coreに必須。pixel/depthの偽陰性と保存CPUに対するarea/run偽陽性の両方を確認。
- front facet/depth: facet出現あり。同facetのdepth ordering誤予測もあるためfacet選択だけの修正では足りない。
- floor cell: 既存12枠でbond32のaffine/native floor差0、bond34は計16 sample差。切替自体はMILPで選択可能だがsample座標の線形化誤差は残る。
- ceil branch: この12枠ではnative/affine stepsが一致。ceil境界をまたぐ独立native witnessではないためceil27の真の領域を保証しない。
- pixel pool: 上記保存GPU captureで不足0。box全域のpool充足は未証明。

## 修復・停止判断

**今回修復して採用したcandidate制約は0。** 行の追加削除やpixel数・depth許容幅を、診断がfeasibleになったことだけを理由に採用していない。native不一致は確認できたが、それを直したpiecewise native modelがcoreの同時充足を回復することは未検証。幾何条件の真の競合と、近似によるjointな偽陰性を最終的に分離するところまでは未達である。

次の最小再開地点は、**bond32 coverage/depthとbond34 runを一貫したnative quantization/facet/depthモデルで表現し、上記の保存非ゼロ姿勢で両符号の画素誤りとfloor切替を検査すること**。PIB ID例外・一定slackの投入・古い枠の延長を修復案にしない。ceil26のcoreから先に修復を検証し、ceil27ではbond32/34の両runを保持する。すべての元の面積/連続長条件を復帰したモデルの整合性確認後にだけ、独立protocolの新candidate予算を設ける。

新candidate solve0、有効候補0、全11原子/10結合の新候補CPU判定NOT_RUN、GPU0、formal0/3。診断primalは条件削除系の証拠でありcandidateとして転用しない。FEASIBLE / PROVEN_INFEASIBLE / MODEL_FEASIBLE_ONLYはいずれも宣言しない。認証済み除外領域0。

## 検証とGitHub状態

変更はoffline診断・保存証拠・その検証・文書のみ。graph/XYZ/native mesh、production160ファイル、formal thresholds、renderer、orientation selection、保存/PWAは不変。40方向/1anchor、650/250ms、Stage B固定step/性能閾値を維持。後続のPIB正式3/3、All25/fixed12、V0–V8/C01–C09/S10–S16、PAN/NBR、resource/heap、strict Stage B、Finite real RAF、Save/Collection/Engineering、Repository Validation CI/FIELD Insight/PWA browser、最終release reviewはNOT_RUN/NOT_CERTIFIED。

新4件のretained-evidence testsは4/4 PASS。最終regression・PWA freshness・hygieneの実行結果はmanifest/logsを正本とする。保存入力のgeometry回帰を新GPU/性能受入の代用にしない。診断保存の`[skip ci]`はrelease免除ではない。PR #354はDraft/Open/Unmergedを維持、main不変。Task⑤未達をTask⑥へ移管しない。

所有ツール: `scripts/diagnose-polymer-task5-conflict.py`（消費済みprotocol、再実行禁止）、`scripts/audit-polymer-task5-conflict-native.mjs`（保存済み入力の診断）、`scripts/verify-polymer-task5-conflict.py`（solverなし証明検証）。通常の再検証は新solver/rasterを起動しない:

```sh
node --test tests/polymer-task5-conflict.test.mjs
```
