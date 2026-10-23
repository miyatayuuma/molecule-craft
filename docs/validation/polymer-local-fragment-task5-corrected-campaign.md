# Task⑤ PIB corrected constraint campaign — UNRESOLVED / BLOCKED

開始authority: main `593ac571e4d664f7af885855352142874dd227ab`、PR #354 HEAD `6f85d3a4635c55fcde647207d94f469aeb1122f6`。GitHub connectorと`git ls-remote`で一致を確認。PRはDraft/Open/Unmerged、既存5 inline threadはresolved。開始HEADのPR workflow runは0件であり、CI PASSではない。Codexの[開始HEAD診断review](https://github.com/miyatayuuma/molecule-craft/pull/354#issuecomment-6375385859)は2026-10-23 21:46:24 UTCに重大指摘なし。最終release reviewの代用にはしない。

**結果: 修正版モデルのpreflight PASS。独立した新2枠とも近似MILPはinfeasible、incumbent 0、候補姿勢0。新候補CPU raster 0/6、GPU 0/1。真の姿勢のfeasibilityはUNRESOLVED、Task⑤ BLOCKED。** 旧12枠と無効2枠は再実行しておらず、今回の結果と予算を分離した。今回の近似infeasibleも真の姿勢の不可能性証明にはならない。認証済み除外領域0、formal PIB GPUは従来0/3。

[protocol](polymer-local-fragment-task5-evidence/recovery/pib-corrected-6f85d3a4/protocol.json) /
[preflight](polymer-local-fragment-task5-evidence/recovery/pib-corrected-6f85d3a4/preflight.json) /
[全結果・hash manifest](polymer-local-fragment-task5-evidence/recovery/pib-corrected-6f85d3a4/manifest.json)。

## Preflightと凍結

既存の[model consistency](polymer-local-fragment-task5-model-consistency.md)、[pixel exchange](polymer-local-fragment-task5-pixel-exchange.md)、[boundary recovery](polymer-local-fragment-task5-boundary-recovery.md)と保存native mesh・maskを再利用した。モデル再構築・seed raster再実行・旧solver枠の再実行はない。inputの修正済みactive-modelはSHA256 `b76094e0d82f071dddefc98de60a7dbb51dec432376efd75a6b32e7d8c4dcfa8`。

- sourceのOR辞書が`clause_terms`へ分離されていることを確認。
- 多cell countの独立truth6ケース、Big-M972ケース、OR5ケース、ceil境界5ケースがPASS。
- 面積式をcellのaffine範囲とbinary採番から独立に再構成。C30・bond32–35の全選択cellが集約され、OR selectorの混入がないことを実モデルで確認。
- 正・負の非ゼロ合成ケースを追加。各3cellの直接カウントを7座標で全binary列挙と照合し、別々のOR分岐が成立することを確認。小規模MILP2件はdelta `[.25,0,0]` / `[-.25,0,0]`、絶対回転ベクトル `[10.25,20,30]` / `[9.75,20,30]`を抽出。全行・bound・integrality残差0。これは合成preflightでありPIB候補枠を消費・追加していない。
- 旧/修復activeの固定seed独立primalをsolverなしで再構成し、全1610/1594行の残差0。ここだけ診断上bond33面積・bond34連続長を外す既存gateを維持し、候補モデルでは両方を有効化。
- C30・bond32–35の予測画素集合を保存CPU maskと比較し完全一致。個数は827/63/92/49/80。
- production対象160ファイルのbyte hashを凍結。graph・XYZ・native mesh・formal grader・閾値・PWAに変更なし。

| 対象 | 固定面積cell | 選択面積binary | OR selector binary |
|---|---:|---:|---:|
| C30 | 564 | 614 | 290 |
| bond32 | 0 | 162 | 41 |
| bond33 | 33 | 136 | 43 |
| bond34 | 18 | 76 | 15 |
| bond35 | 55 | 52 | 27 |

preflight後にprotocol・入力・全実行source・preflight結果のhashを固定。protocol SHA256は`f57556866a2e29a1f318c68975e5600d1ff762b739dfea7999b3bb45f71832a8`。exclusive campaign-started markerと候補historyにより途中停止後の無断再実行も拒否する。

## 新2枠の全結果

Anchor30、保存coupled best seed `[-.054539559717073846,-.10453805899021659,.08315483688476073]`度、rotation-vector component box ±1°、bond34 ceil枝26/27、area surplus0。HiGHS time_limit各30秒、node_limit各5000、relative gap .001。SciPy1.17.0。追加seed・時間延長・blind sweepなし。

| 枠 | Status | 変数 / 制約 | solve秒 | 構築・保存込wall秒 | 有効候補 |
|---|---|---:|---:|---:|---:|
| corrected-r1-n26 | 2 / infeasible | 10381 / 60189 | 21.066180 | 22.036644 | 0 |
| corrected-r1-n27 | 2 / infeasible | 10397 / 60313 | 17.605965 | 18.522213 | 0 |

全制約行・変数bounds・integrality・objective・面積条件・連続run枝・各行のbox範囲を`*-system.json.gz`に保持した。この2ファイルはPython JSONの非有限境界値`Infinity`を含み、Pythonの`json.loads(gzip.decompress(...))`で読む。box範囲だけで矛盾する単独行は両枠0。incumbentがないため、primalに対するbinding active setは存在せず、`primalActiveSet=null`と明記した。これを空集合の合格primalと解釈しない。infeasible certificate/IISは取得していない。

候補姿勢を捏造せず、incumbentなしの枠にはquaternion/fitを生成しない。native checkerは候補数0を確認して終了した。全11原子・10結合・Q・fit/depth・3算術modeの**新姿勢の**判定はNOT_RUNであり、FAILやPASSではない。CPU/GPUの未使用予算を別の姿勢探索に転用していない。

## 判定の限界と再開地点

今回、新たなMODEL_INVALIDは検出されていない。ただしpreflightは一般の非ゼロ姿勢でモデルが実rasterと一致する証明ではない。native legacy4 seed定数は一致するが、hull/depthの局所勾配、front facet切替、有限screen pool、floor/ceil半開近似、annotationの移動が残る。proposalに省略した16対象も新姿勢での合格は保証しない。

したがって**UNRESOLVED**。MODEL_FEASIBLE_ONLYでもFEASIBLEでもPROVEN_INFEASIBLEでもない。bond33の姿勢依存面積とbond34の7.75px連続長を実meshで同時に満たすwitnessは今回得られなかったが、同時充足不可能とは証明していない。既存seedのbond33 `92 < 94.628705176px`、bond34 `7.474644037 < 7.75px`は保存済みの旧実測であり今回の新rasterではない。

次の最小再開地点は、保存した完全制約系と実native境界から、非ゼロ姿勢で必要なpixel/facet/depth切替を局所affineモデルが排除していないかを解析し、候補構築の根拠を改めること。あるいは許容姿勢領域を厳密に囲む除外証明が必要。同じ2枠の時間延長・追加seed・再実行を再開手順にしない。旧12枠・無効2枠も除外証明として使わない。

## Productionとrelease

変更はoffline campaign driver、再実行しないretained-evidence tests、文書・証拠のみ。汎用orientation selectionへのproduction修復は未採用。PIB専用quaternion・原子ID例外・graph/XYZ変更・非表示・偽結合なし。40方向/1anchor、reset/pointer、save schema、160反復、650/250ms、Stage B固定step・性能閾値を維持。PR #345は未変更。

PIB正式3/3が未達のため、後続のAll25 browser/fixed12 visual、V0–V8/C01–C09/S10–S16、PAN/NBR L1、最終resource/lifecycle/PF heap、normal/reduced mobile/desktop、Save/Collection/Engineering、strict Stage B/Finite real RAF、Repository Validation CI/FIELD Insight/PWA browser、独立final-release reviewは**NOT_RUN/NOT_CERTIFIED**。保存証拠のdeterministic回帰を、これらの新規受入の代用にしない。

Ready化・merge・post-merge verificationなし。PR #354はDraft/Open/Unmerged、mainは開始SHAのまま。Task⑤未達をTask⑥へ移管しない。診断保存の`[skip ci]`はfull browser campaignを起動しないためであり、release免除ではない。

今回の関連deterministic regressionは **58/58 PASS、0 FAIL、0 SKIP**。PLA/PET固定入力、25 final/95 intermediate geometry、観察・raster・resource/heap/static契約と旧/新保存証拠を含む。PWA freshnessは353資産一致、repository hygieneは0 warnings、syntax/diffもPASS。production対象160ファイルのhashは実行前後で一致した。全結果をmanifestとlogsへ保存した。過去native入力を再描画する回帰は、新候補raster0とは別の検証である。

所有ツール: `scripts/solve-polymer-task5-corrected-campaign.py`。import先の修正版solver・独立logic oracleと既存native checkerを再利用。通常の保存証拠検証はsolver/rasterを起動しない:

```sh
node --test tests/polymer-task5-corrected-campaign.test.mjs
```
