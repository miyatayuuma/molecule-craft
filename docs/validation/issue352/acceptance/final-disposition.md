# Task④ / Issue #352 — 最終受入判定

判定：**Task④ CLOSED**。Issue #352はcompletedでclose済み。

- 開始main：`6c676317ff590dd756685168484c79788b5a329b`
- 修復PR：[#353](https://github.com/miyatayuuma/molecule-craft/pull/353)、HEAD `e5ce3d1b5168e670990b40081cc9246922289d90`
- 実merge／最終main：`593ac571e4d664f7af885855352142874dd227ab`
- 審査HEAD／mainのtree：`7dad9ba4df1824276efc9121b0de5829f7704610`、完全一致
- Issue [#352](https://github.com/miyatayuuma/molecule-craft/issues/352)：CLOSED／completed（GitHub更新結果で確認）
- PR #345：OPEN／UNMERGED、HEAD `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`、変更なし

## 修復と確証の範囲

固定step全体のwall timeを監査し、physics／body同期／polymer runtime／matcherの境界を確認。旧GPU presentationの原因証拠は流用していない。

高い確証で確認できた修復対象は、matcherにおける同一stepの原子座標とparticipant pair全原子距離の不要な反復計算。診断の観測時間の約98%をmatcherが占め、CPU stackと計算回数でも確認した。実productionのreactionStepだけにlazy cacheを導入し、座標計算19,968→14回、pair評価9,216→48回へ削減した。

旧mainを直接使う独立oracleで、全29 rules・384候補・全diagnostics・dwell・arbitration・commit入力の完全一致、次stepの姿勢変更後の再計算、busy／supplemental／isolation／overlap／環境条件を検証。physics、profiler、baseline SHA、warm-up、4 trial、8.333333333333334ms閾値と全測定値の包含は変更していない。

旧失敗の各clusterにおけるGC／JIT／OSの内訳は未確定。過剰計算が変動に対する余裕を減らしたことは推論であり、定常的な冗長性だけで51–53等の集中機構が完全に説明できたとはしない。診断のRAF混入・先頭180記録制限・runner分離・Chrome差・overhead推定不能は既存reviewとrawに保持した。診断をstrict合格の代替に使っていない。

## Stage B — すべての試行を保持

表はbaseline／candidateの4 measured trial P95とpooled P95（ms）。warm-upと全150 durationsは隣接raw JSONに保存。

| 実行 | baseline trial P95 | candidate trial P95 | pooled baseline / candidate | 結果 |
|---|---|---|---|---|
| 旧main失敗39454378232 | 7.5 / 7.2 / 11.0 / 8.1 | 10.0 / 7.7 / 7.9 / 7.9 | 8.8 / 8.1 | FAILを保持 |
| 修復PR39518445476 | 6.1 / 5.7 / 5.7 / 7.1 | 4.3 / 4.2 / 3.9 / 4.0 | 6.0 / 4.0 | 全4 checks PASS |
| 実main39520340651 | 8.3 / 13.3 / 8.0 / 8.3 | 5.9 / 5.0 / 5.1 / 5.1 | 10.7 / 5.1 | 全4 checks PASS |

PRとmainのcandidateはそれぞれ全600 measured stepsが8.333ms未満。baselineのFAILをcandidate免除に利用していない。PRのChromeは155.0.8059.39、postmergeは155.0.8059.84で、各run内のbaseline／candidateは同一revision。run間の環境差は残す。

両通常runのraw／log／artifactと未変更比較器のoffline再計算結果は完全一致。再実行で失敗を置換していない。

## 必須検証と保存

- PR Repository39518445543：8/8 jobs・全steps PASS。独立generic gateも384候補を維持してP95 2.0/1.9/2.1/1.9、pooled1.9ms。
- PR FIELD39518445509：全PASS。
- PR Finite39518445476：全PASS。全40 profiles、両画面／normal-reduced比較、resource、保存／Collection／Engineering／再FEED／trusted FIELD、pointer／release／blur、PWA353 assetsを確認。
- main Stage B39520340651/job118962378077：全PASS、raw/offline一致。
- main Finite39520340651/job118962378468：全steps PASS、40 profiles／resource gate／未変更比較器offline再計算一致。
- main PWA refresh39520340528・Pages39520340329：全PASS。
- Repository／FIELDはmainで新たに実行したとは扱わず、完全同一treeのPR受入を再利用する。

全25ルートgeometry、graph、bond orders、atom origins、sample identity、determinism、nitrile／芳香環／官能基／PF two-ring、fallback／再FEEDのproduction authorityは変更なし。25/25 geometry PASS、fallback0／severe overlaps0。save schema、FIELD confirmation、pointer/release契約も保持。

独立修復review、独立PR最終review、GitHub自動code review（findingsなし）を完了。postmerge独立reviewも全受入充足と判定済み。旧FAILと当時のBLOCKED判定は履歴として保持する。

## Task⑤への正式引き継ぎ

最終必須検証PASSにより、main593ac571をTask④のgeometry/API authorityとして引き継ぐ。Task⑤ではThree.js描画、camera/safe-region、操作、resize／resource／実RAFを扱う。既存desktopの長frame（PR最大116.7ms、main最大116.8ms）、Node geometry生成tailや未解明GPUリスクはこの修復で解決したとはしない。PR #345の変更・統合はしていない。

最終postmerge rawと独立reviewは同じacceptanceディレクトリに保存。Issue閉鎖のreceiptは `closure-receipt.json`、最終main／tree・全job/step状態は `main-jobs.json`、Stage B全durationは `main-stage-b/*.json`、Finite全21 JSONは `main-finite.json.gz` を参照。
