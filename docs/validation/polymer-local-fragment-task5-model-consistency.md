# Task⑤ PIB constraint-model consistency — PASS at seed / UNRESOLVED / BLOCKED

開始authority: main `593ac571e4d664f7af885855352142874dd227ab`、PR #354 HEAD `8227174df14f91a2b4c4ab2b62f1e472e6bb12b4`。GitHubと`git ls-remote`で一致を確認。PRはDraft/Open/Unmerged、全5 inline threadはresolved、開始HEADのworkflow runは0件。Codex review summaryは2026-10-23 14:40:53 UTCに同HEADをcompleted/findings=falseと記録。これは診断レビューであり最終release reviewではない。PR #345もOpen/Unmergedのまま保持した。

**結論: 既知状態を表現できない、という仮説は今回の固定seedでは棄却。旧モデルも指定された2条件だけを外せばfeasible。画素単位の近似誤差と過剰な遮蔽条件を修復し、active5対象のseed画素集合を完全一致させた。新しい有限2枠は実装不具合で無効と判明し、採用できる候補判定0。PIB feasibilityはUNRESOLVED、Task⑤はBLOCKED。** 真の姿勢の不可能性証明はなく、認証済み除外領域は0。

[監査・hash manifest](polymer-local-fragment-task5-evidence/recovery/pib-model-consistency-8227174d/manifest.json) /
[新active実験protocol](polymer-local-fragment-task5-evidence/recovery/pib-active-constraints-8227174d/protocol.json) /
[旧pixel-exchange](polymer-local-fragment-task5-pixel-exchange.md) /
[boundary](polymer-local-fragment-task5-boundary-recovery.md) /
[coupled](polymer-local-fragment-task5-coupled-feasibility.md)

## 固定seedの整合性gate

回転差分を厳密に`[0,0,0]`へ固定。診断で無効化したのは**bond33面積**と**bond34連続長**だけ。その他全指定11原子・10結合の面積・連続長・寸法、bond32/35、C30、Q、fit/depthは保持した。旧MILPが直接表現していなかった他結合の連続長・寸法・fit/depthは、同じ固定状態を既存native oracleのgraderで別途再判定し合格を確認した。production・正式受入の条件変更は0。

- 旧MILP: 162変数 / 1610制約、HiGHS status0/optimal、incumbentあり、deltaはゼロ。solver部0.008400秒。
- 旧近似maskでも、bond32面積63 ≥61.702818662、連続長7.849078266 ≥7.75、bond35面積81 ≥46.546630771、連続長12.834141315 ≥7.75。C30は823 ≥815.779131517。
- 保存CPU maskの全指定pixel集合と比較。seedで見えているのにpoolに存在しない画素は全21対象とも0。全結合のfloor先cellと全lane sampleを保存し、32/34/35の連続長が旧近似集合でも同値であることを確認した。
- fit/Q/near/farはすべてPASS。保存CPU maskを再gradeした結果は既存seed.gradeとdeep-equal。既知FAILはbond33と34のみ。
- Big-Mの`y⇒f≥t`は、boxでの最小値`min(f)`により`M=max(0,t−min(f))`とする。y=0でbox自身の下限、y=1で本来の閾値となる。≥/≤について972ケースの直接代入で検証し、binary implicationの逆転は検出しなかった。新しいdepth ORも5ケースで全binary割当を列挙した。
- HiGHS結果とは独立に、固定seedのbinary選択を単調な論理伝播で構成し、全1610行 / 修復後1594行の残差0のprimalを保存した。この検証にsolver呼出し・rasterはない。

したがって「C30の4画素不足がseedの合格状態すら落としていた」とは結論しない。閾値成立とpixel集合の一致は別の検査である。gateの成立はこのseedについてだけであり、非ゼロ姿勢で旧モデルの偽陰性がない証明ではない。

## 特定した誤差と過剰制約

1. **C30の827/823差**: (159,236)はblocker輪郭外余裕0.002360941pxで、旧proposal独自の0.005pxに届かず除外された。他3画素 (159,257), (140,268), (146,272) はunquantized hullと保存legacy4 native rasterのsubpixel coverage差。annotation除外・pool不足が原因ではない。生triangle owner/depth、各拒否条件と実座標を全対象の不一致画素ごとに保存した。
2. **native coverage**: unquantized hullの定数をlegacy4のnative triangle投影へ変更。既存rasterizerの`projectOnly`経路はvertex/triangle計算で止まり、画素描画loopへ入らない。新seed画像や候補CPU rasterは生成していない。
3. **pixel ownership/depth**: 旧モデルはseedでfrontと割り当てた遮蔽物について「hull外」を要求し続けた。この条件は「targetより奥側へ回る」経路を禁止する追加制約。新モデルは「hull外 OR targetより奥側」を選べる。native Float32 depth-planeと同じseed定数、選択facetの局所depth勾配を用いる。seedで奥とされたため旧候補から抜けたblockerも近接poolへ追加した。bond35の(199,184)は旧モデルがbond所有と誤予測したが、native丸めではatom33 (ID34) が勝つ。このpixelを新depth分岐が正しく除外した。
4. **annotation**: 旧モデルはcircle strokeに乗るcellを一律除外した。formal layerはmodel silhouetteがannotationを覆う部分を残すため、そのseed規則へ合わせた。今回のactive6画素の修正をannotationの効果とは主張しない。
5. **floor/ceil**: 移動sampleのfloor cellと連続run開始位置は選択可。旧位置の個別pixel保持は要求しない。bond34ではL≤13のsteps26とL>13のsteps27を分離する。必要hit数は12.956049664/13/13.0001/13.078125/13.08pxに対し17/17/18/17/17。ceil分岐そのものに今回のseed不整合はなかった。MILPの半開cellは上端から1e-7を控える近似が残り、厳密な全領域除外には使えない。

修復後のactive5対象は**countだけでなくpixel集合全体**が保存済みmaskと一致した。

| 対象 | 保存CPU画素 | 旧model | 修復model | 必要面積 |
|---|---:|---:|---:|---:|
| C30 | 827 | 823 | 827 | 815.779131517 |
| bond32 | 63 | 63 | 63 | 61.702818662 |
| bond33 | 92 | 92 | 92 | 94.628705176 |
| bond34 | 49 | 50 | 49 | 37.792531988 |
| bond35 | 80 | 81 | 80 | 46.546630771 |

修復active固定seed solverもstatus0、162変数 /1594制約、deltaゼロ（0.005391秒）。途中のmembership v0（bond35の1偽陽性残存）とv1（数値scale前）を保持した。これらはmodel構築の診断であり、候補solverや姿勢探索は実施していない。depthの単位を1e6倍し、Float32の差とbinary implicationをsolverの数値許容誤差に埋もれさせないようにした。

## 最小active制約と固定予算

activeはC30、bond32/33/34/35の面積、32/34の可変floor/ceil連続run。bond35連続長はseedで5.084141315pxの余裕がありproposalから省略した。その他16対象もseedに余裕があることを独立監査したためproposalから省略するが、新姿勢での成立は保証しない。候補が出れば全11原子・10結合を、bond35連続長も含む正式条件で再gradeする契約を維持した。新bond33必要面積は新投影長・幅から再計算するcheckerを再利用し、旧94.6287を正式候補の固定閾値にはしない。

モデルは全graphのnative meshと、H5/bond33、C35/bond34、bond32、bond35の実遮蔽輪郭から導出。固定seed pose/XYZ/graph/meshを維持する。旧21,708cellのscreen poolからactive5の2370cellへ縮約した。既存12枠・旧姿勢・旧seedの探索を再実行していない。

候補生成前に予算を固定: rotation-vector component boxはseed±1°、steps34は26/27、surplus0、**新2枠**、各HiGHS30秒/node5000、CPU最大6（各候補3算術mode）、GPU最大1（3mode全条件PASSのみ）。出力は全保存、候補0なら停止。

| 無効な新枠 | 変数 / 制約 | 構築+solver秒 | 保存された生solver結果 | 提案姿勢 |
|---|---:|---:|---|---:|
| active-r1-n26 | 10381 / 60189 | 0.232433 | 近似上infeasible | 0 |
| active-r1-n27 | 10397 / 60313 | 0.217315 | 近似上infeasible | 0 |

**この2枠は判定無効。** 非ゼロboxでORをbinary化する際、条項用の一時辞書`terms`が対象全体の面積式`terms`を上書きしていた。十分な可視pixelがあっても面積式にほぼ最後のcellしか残らず、過剰制約による偽のinfeasibleを生む。seedでは全cellが定数となりOR用binaryを構築しないため、旧・修復seedの整合性PASSと独立primalは影響されない。旧12枠の入力にはORがなく、この不具合は新しい縮約実装に導入されたもの。旧12枠の失敗原因を説明したとは主張しない。生出力を残し、無効判定を別ファイルへ明記した。固定2枠は消費済みとし、修正後の追加candidate solveは行わない。誤った実行sourceはcheckpoint commit `ab8c0775fcbcefba8e383a0c98cd0542451560cb`に保持した。修正はOR用辞書を`clause_terms`へ分離する2行のみ。2cellの可視pixel数を独立に数える6ケースのBoolean oracleを追加し、旧sourceで`areaCountMismatch`を再現、修正後は全ケースPASS。solver呼出し0/raster0のまま、旧・修復seedの全primal行も残差0で再検証した。

CPU **0/6**、GPU **0/1**。Actual PNG、native GPU ID mask、photometry、pointer focus/resetの新証拠は0。Formal GPUは従来の**0/3**。2枠のinfeasibleは、正しいactiveモデルの判定としても採用しない。真の姿勢に対する不可能性証明でもraster FAILでもない。timeout0、再試行0、追加sweep0、未使用予算の転用0。

## 残る制限と停止判定

**Model consistency: PASS_AT_FIXED_SEED。Feasibility: UNRESOLVED。Task⑤: BLOCKED。** 旧seed gateはMODEL_INVALIDではないが、新active campaignはMODEL_INVALIDとして無効化した。全体のfeasibilityはUNRESOLVEDであり、FEASIBLE/PROVEN_INFEASIBLEではない。

seedのnative定数は整合したが、非ゼロ姿勢のhull/depth勾配、選択front facet、ceil/floor、有限pool、annotation位置には局所近似が残る。depth ORで選んだfacetが別facetへ替わる領域やpool外の新pixelは安全に囲んでいない。省略した16対象もある。したがって2枠を除外証明に使わない。旧box全域、steps25/28、他roll/focus/SO(3)は未除外のまま。旧bond33/34実測FAILは改善していない。

次の最小再開地点は、**多cellの独立論理oracleで確認済みの面積集約修正版に対して、別途固定された候補生成予算を設けること**。今回の固定2枠を有効な結果として再利用しない。さらにactive5のnative facet/coverage/depthの切替を含む整合モデルが必要である。有限pool・局所勾配が必要なwitnessを落としていないかを、保存したzero-delta primal・2370cell・全不一致pixelから検査できる。今回の2枠の時間延長・radius追加・blind sweepを再開手順にしない。

## 検証・release状態

今回の変更はoffline診断scripts、retained-evidence tests、この文書とhash-bound artifactsのみ。production renderer、geometry、graph/XYZ/native mesh、origin/identity、保存schema、PWA、40方向/1anchor、650/250ms、Stage B固定step・性能閾値に変更はない。汎用orientationのproduction修復は未採用。

最終関連deterministic regressionは **47/47 PASS、0 FAIL、0 SKIP**。PLA/PETの固定入力、25final/95intermediate geometryもPASS。PWA freshnessは353資産、hygieneは0 warnings、syntax/diffもPASS。実行結果はmanifestとlogsに保存した。保存入力を再検証するregression rasterと、新候補のraster0は区別する。これらは実ブラウザ・性能受入の代用ではない。

PIB3/3、All25 browser、fixed12 visual jobs、V0–V8/C01–C09/S10–S16、PAN/NBR L1、最終resource/lifecycle/PF heap、strict Stage B、Finite real RAF、Repository Validation CI、FIELD Insight、PWA browser、Save/Collection/Engineering、独立final release reviewは本checkpointでは**NOT_RUN/NOT_CERTIFIED**。PR #354はDraft/Open/Unmergedを維持し、merge/post-mergeなし。main不変。Task⑤の未達をTask⑥へ移管しない。診断保存commitの`[skip ci]`はrelease免除ではない。

所有ツール: `scripts/audit-polymer-task5-model-consistency.mjs`、`scripts/prepare-polymer-task5-active-constraints.mjs`、`scripts/solve-polymer-task5-active-constraints.py`、`scripts/verify-polymer-task5-model-logic.py`。共用する`solve-polymer-task5-pixel-exchange.py`はimport時の実験起動を廃止し、OR条項と診断上の2条件無効化を明示引数にした。通常の旧CLIでは全条件を維持する。`analyze-polymer-task5-exact-mesh.mjs`のprojection-only経路は通常raster経路を変更しない。productionからimportしない。

保存済み結果の再検証（候補探索・solver・新rasterを起動しない新test）:

```sh
node --test tests/polymer-task5-model-consistency.test.mjs
```

修正後モデルの独立した新2枠は [corrected campaign](polymer-local-fragment-task5-corrected-campaign.md) を参照。非ゼロ合成preflightもPASSしたが、新2枠は近似上infeasible、候補0、CPU/GPU0、PIB UNRESOLVEDのまま。このページの無効2枠とは別の記録である。
