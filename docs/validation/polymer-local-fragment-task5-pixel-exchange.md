# Task⑤ PIB pixel-exchange feasibility — UNRESOLVED / BLOCKED

開始authority: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `a664c1da27fced58ec76fc3be13592b695f71629`。GitHubとlocal checkoutで一致を確認。PR #354はDraft/Open/Unmerged、全5inline threadはresolved、PR #345もOpen/Unmergedで未変更。開始HEADのcheck-runsは0件であり、CI PASSを意味しない。Codex診断receipt [6366952612](https://github.com/miyatayuuma/molecule-craft/pull/354#issuecomment-6366952612)（2026-10-23 14:14:50 UTC）は開始HEADに重大指摘なし。最終release reviewではない。

**結果: Task⑤ BLOCKED / feasibility UNRESOLVED。** 事前固定12個のMILP枠は近似上infeasible5件、時間上限でincumbentなし7件。提案された姿勢0、native-mesh候補CPU raster0、追加GPU0。したがって新しいBond33/34の実測値、Actual PNG、native ID mask、photometryは存在しない。12姿勢をrasterでFAILさせたという結果ではない。近似上の解なし・timeoutを、実姿勢の不可能性証明へ昇格しない。認証済み除外領域0。

[全記録・hash manifest](polymer-local-fragment-task5-evidence/recovery/pib-pixel-exchange-a664c1da/manifest.json)。既存の[boundary ledger](polymer-local-fragment-task5-boundary-recovery.md)、[coupled ledger](polymer-local-fragment-task5-coupled-feasibility.md)、native mesh/parity原本、旧12候補FAILはそのまま保持した。旧探索・旧LPを再実行していない。

## Pixel-exchange制約と旧LPとの差

固定graph・XYZ・native sphere/cylinder Float32 mesh・local transformを再利用。seedは既存coupled bestの回転ベクトル `[-0.054539559717073846,-0.10453805899021659,0.08315483688476073]` 度。全proposalは旧boundary30#0 quaternionへrotation-vectorを左乗算し、同じproduction explicit-quaternion fit、shell pivot、.92 headroom、safe region、whole-graph depth budgetを使う。新seed rasterは行わず、保存済みCPU ID PNGをdecodeした。

旧LPは可視だった特定screen cellすべてをguardし、その同一位置の可視性を要求した。今回は次の存在制約へ置換した。

- 全11指定原子・10指定結合の画素候補poolを作り、各cellに選択binaryを置く。選択したcellだけが、native convex silhouetteの内側かつ局所的に手前の遮蔽物の外側になることを要求する。seedで見えていたcellを選び続ける制約はない。新しいcellへ交換できる。box内で全ての**近似**条件に余裕のある深い内部cellは定数として集計する。
- 各原子は新投影半径から0.60πr²、各結合は新投影長×幅×0.50を線形化し、選択cellの合計で満たす。graphから決まる全対象集合を維持。C30にも面積制約を置く。
- bond32/34の連続長は、可視位置を固定しない。新しいlane上のj/stepsと3横offsetの座標を線形化し、floor先screen cellをbinaryで選択し、そのcellの可視witnessへ結びつける。連続runの開始位置も選択できる。
- bond32は近似投影長範囲が含むsteps34…41を分岐。bond34は今回の指定に近いsteps26/27の二つを固定列挙。各分岐に `(n-1)/2 < L <= n/2`、選択runに `intervals*L/n >= 7.75` を課す。最小runより1〜2interval長いrunも候補化する。
- 目的はseedからのL1回転変化の最小化で、raster scoreを反復最適化しない。全候補枠の生成完了後だけ、得られた姿勢をnative-mesh CPU oracleの3算術方式で全独立条件に照合する仕様。atom diameter、全10bondのwidth/length/area/continuous、Q、fit/depthもそこで検証する。今回はincumbentがないためこの段階へ進めなかった。

poolは全21対象・21,708 cell。実meshを±.01°で投影して局所勾配を求めたが、これはraster実験ではない。`events.json.gz`はbond33の追加露出候補cell/遮蔽条件、bond34の全j/offset/新floor候補用座標、bond32/35を含む全対象の集計余裕を保存する。`model.json.gz`は実行した全制約入力である。

これは真の非線形投影・depth orderingを囲む保守的なintervalモデルではない。closest hull edge/facet、depth ordering、sample floor、ceil、subpixel量子化が変わる。screen poolの有限padding、annotation境界除外、最小run+2までの列挙、局所depth assignmentもproposal側の制約である。**偽陽性・偽陰性の双方があり得る。** 特に、seed自体でC30は保存CPU827pxに対し近似witness823px、bond34/35は近似が1px多い。これだけでもモデルが除外証明ではないことを確認できる。

## 予算・全12枠

候補生成前に`protocol.json`を保存。radius [.5,1,2]度 × bond34 steps [26,27] × proposal area surplus [0,2]px の12枠で固定。surplusは全対象への候補生成余裕であり、正式受入閾値ではない。coverage clearance .005pxもproposalの数値条件であり、正式graderの変更ではない。

HiGHSのtime_limitは各45秒、node_limit10000、relative gap .001。表の秒数はPython側の構築・変換・solverを含むwall elapsedで、45秒の厳密なwall-clock killではない。大きい枠では内部time limitの確認・前後処理を含め約94〜95秒になった。この差を隠して「各45秒以内」とは報告しない。再試行・予算拡張0。CPU上限36（得られた各枠×3mode）、GPU上限1（全mode全条件PASSのみ選択）。未使用予算を別探索に転用しない。

| 枠 | Solver判定 | 変数 / 制約 | wall秒 | 提案姿勢 |
|---|---|---:|---:|---:|
| r0.5-n26-a0 | 近似制約で解なし | 6341 / 20298 | 0.664 | 0 |
| r0.5-n26-a2 | 近似制約で解なし | 6341 / 20298 | 0.507 | 0 |
| r0.5-n27-a0 | 近似制約で解なし | 6362 / 20447 | 0.425 | 0 |
| r0.5-n27-a2 | 近似制約で解なし | 6362 / 20447 | 0.500 | 0 |
| r1-n26-a0 | 時間上限・解なし | 17647 / 70804 | 46.200 | 0 |
| r1-n26-a2 | 時間上限・解なし | 17647 / 70804 | 46.152 | 0 |
| r1-n27-a0 | 時間上限・解なし | 17663 / 70928 | 45.415 | 0 |
| r1-n27-a2 | 近似制約で解なし | 17663 / 70928 | 40.890 | 0 |
| r2-n26-a0 | 時間上限・解なし | 75591 / 383789 | 93.775 | 0 |
| r2-n26-a2 | 時間上限・解なし | 75591 / 383789 | 95.202 | 0 |
| r2-n27-a0 | 時間上限・解なし | 75658 / 384224 | 50.013 | 0 |
| r2-n27-a2 | 時間上限・解なし | 75658 / 384224 | 48.614 | 0 |

全枠でprimal incumbentなし。残余が正の擬似姿勢を作ったり、infeasible/timeout枠をPASS/実測FAILと呼んだりしない。`candidate-history.jsonl.gz`に各solverのstatus/message/規模/時刻、`candidates.json.gz`に全枠、`results.json.gz`にCPU未実施と空の観測列を保持する。全枠を生成するまでraster評価を開始しない契約も保持した。

## Bond33/34の実条件と除外できない領域

既存seedのnative-mesh CPU実測はbond33 **92 < 94.628705176px**、bond34 **7.474644037 < 7.75px**。今回の新実測ではなく、改善も立証されていない。seedのbond32面積余裕は **1.297181338px**、連続長余裕.099078266px。bond35面積余裕33.453369229px、連続長余裕5.084141315px。C30のraw面積余裕11.220868483pxも無視できない。atom/bondの面積と正式graderのannotation処理は独立に区別する。

新姿勢のbond33では必要面積も変わるため「旧位置の追加2画素」だけを成功条件にはしない。新しい全可視面積が新しい長さ×幅×DPR²×.50以上でなければならない。

bond34では、L=12.956049664px、n=26、j11…26の16hitは15intervalしか持たない。必要なのは少なくとも17連続hit。Lを13.0001pxへ伸ばすとn=27へ変わり、必要hitが18へ増える。n=27で17hitへ戻るにはL≥13.078125pxが必要。これは正式サンプル式からの算術条件であって、j10が実際に可視になる証拠ではない。

以下は**すべて未除外**である。

1. 旧boundary30#0に左乗算するrotation vectorの成分box：x∈[-2.054539560,1.945460440]、y∈[-2.104538059,1.895461941]、z∈[-1.916845163,2.083154837]度。小さいMILP-infeasible boxも、真の姿勢としては未除外。
2. n26領域：12.5<L≤13、連続hit数≥ceil(201.5/L)+1。C35境界をまたぐ新floor cellと、bond33新面積が同時成立する可能性を否定できない。
3. n27領域：13<L≤13.5、連続hit数≥ceil(209.25/L)+1。timeoutはこの領域を一切除外しない。
4. n25/28、上記box外のroll、他の許容focus・SO(3)領域。今回の候補モデルはこれらを列挙していない。

`seed-model-audit.json`に数値box・全21対象の近似誤差・残る必要条件を保存した。成立を阻む普遍的条件は証明できていない。次の最小の未解決点は、pixel所有権・新floor/ceil・depthを保守的に囲んだ領域判定、または全native-mesh条件を満たす具体的witnessである。今回のMILPを長時間化して再実行することを再開条件にはしない。

## 検証とproduction/release状態

変更はoffline制約構築・solver・固定候補checker、retained-evidence tests、このledger、hash-bound artifactsだけ。production renderer、geometry生成、graph、XYZ、mesh、atom origin、identity、save schema、PWA資産は開始HEADから変更0。40方向/1anchor、pointer focus/reset、650/250ms、Stage B固定step・性能閾値も変更0。汎用orientation選択のproduction修復は採用していない。

既存入力のPLA/PET、Task4の25final/95intermediate geometry、観察・raster・resource/heap/static契約を検証。40既存回帰＋8geometry＋3新検証の合計 **51 tests PASS / 0 FAIL / 0 SKIP**。PWA353資産freshness、hygiene0warnings、syntax/diffもPASS。過去5manifestの78hash項目を照合し、実行中に記録したtool hashも一致した。個別の結果はmanifestとlogに記録する。保存maskを読む検証や旧入力のregression replayは、今回の新候補探索・GPU測定とは区別する。

正式GPUは従来の0/3。新Actual PNG/native mask/photometryなし。All25 browser、fixed12 visual jobs、V0–V8/C01–C09/S10–S16、PAN/NBR L1、最終resource/lifecycle/PF heap、strict Stage B、Finite real RAF、Repository Validation CI、FIELD Insight、PWA browser、Save/Collection/Engineering、独立final release reviewは今回NOT_RUN/NOT_CERTIFIED。過去PASSや診断reviewで代替しない。PIB3/3未達のためReady化・merge・post-mergeなし。PR #354はDraft/Open/Unmerged、main変更なし、Task⑥へ未達移管なし。

今回のcommitは診断保存の[skip ci]で無関係なbrowser campaignを起動しない。release gateの免除にはならない。

## 所有ツールと再検証

`scripts/prepare-polymer-task5-pixel-exchange.mjs`、`scripts/solve-polymer-task5-pixel-exchange.py`、`scripts/check-polymer-task5-pixel-exchange.mjs`はこのledger所有のoffline tooling。production/RAFからimportしない。準備・候補生成・raster checkerは既存出力の上書きを拒否する。protocolはartifactの原本を使用し、通常検証で実験を再起動しない。

保存済み結果を再検証する場合：

```sh
node --test tests/polymer-task5-pixel-exchange.test.mjs
```
