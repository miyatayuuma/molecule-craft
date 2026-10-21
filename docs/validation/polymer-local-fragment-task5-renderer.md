# Task⑤ finite Sample renderer — BLOCKED

開始main: `593ac571e4d664f7af885855352142874dd227ab`。Task①–④の8文書、Task③ A01–A15/V0–V8/C01–C09/S10–S16を採用する。実装PRは[#354](https://github.com/miyatayuuma/molecule-craft/pull/354)。必須条件がFAILしているためmainへ統合しない。以下の部分的な成功をCLOSEDと読み替えない。

## 実装と限定所有権監査

| 対象 | 変更・所有権 | 検証の限界 |
|---|---|---|
| Atom mesh/source origin | 元の可視meshを実tupleで移管。全明示Hを保持。球24×16、Task③半径/元素色、Standard roughness .32/metalness .08。graph index/element/originをuserDataへ | 全25 numeric graph対応PASS。実ブラウザ全25は未完了 |
| Bond lane | 実orderに1/2/3本。single .050、multiple .038、offset ±.080 / −.160,0,.160、12角。camera facing、平行輸送/決定的fallback。Cylinder poolをtransformで再利用 | PAN4本の実tripleは旧候補PNG/maskで回復。NBR1本と最終候補のraster受入未完了 |
| 完成アニメーション | 既存meshのXYZ移動＋Sample group transform。normal650/reduced250msのready clockを維持 | strict Finite RAFは旧候補FAIL。描画削減後の測定未完了 |
| Initial fit/reset | 実sphere/cylinderを囲むbounds、DOM overlay+8px、edge12px、最大空矩形、48 primary姿勢、実端可視性未達時のみ仕様許容32追加pitch姿勢。vertical FOV42、cameraは動かさずgroupをfit | 全25×3 numeric fit/reset/実端ray可視比≥.70 PASS。最終候補の実mask≥.60は未検証 |
| Orbit/wheel/pinch | .008rad/CSS px、exp(−deltaY*.001)、二指距離比、下限.72/near-far由来上限、局所pivot、deterministic reset | ローカルC01の実イベントで100px=.8rad、wheel exp(.2)、pinch1.5、可視atom tuple、focus/reset PASS。実機はTask⑥ |
| Hit ownership | 実mesh raycast、6px/250ms、touch22px候補明示。既存monomer docking優先。比較/concept中はcanvas pointersを取得しない | 独立review3件を修正。ローカル最初10ルートで二指/比較/close/reopen/resize PASS。全25は未完了 |
| Footer/canvas | FEED前から160px枠を予約、凡例を常設、詳細menuは枠内scroll。通常表示の原子・結合色を意味で変更しない | 同サイズbuffer代入0のunit PASS。全状態のfont/contrast/hitbox grid監査は未完了 |
| Close/reopen/dispose | 比較をdisposeしてstateを保持、reopenで再構築。Sampleはgraph/poseを保持しGPU資源を解放/再構築 | 旧候補13代表mobile/desktop suite PASS。最終候補の全lifecycle未完了 |
| Re-FEED | purgeの所有権で旧Sample、geometry/materialを解放 | 旧候補の実pointer suiteでPASS。全25連続はPETで停止 |
| Resize/DPR/context | ResizeObserver＋RAF coalesce。CSS/DPR実変化時のみdrawing buffer更新、DPR cap2。local/comparisonを新Sへfit。context lossでpointer/render停止 | numeric no-op/cap PASS。C01ローカルcontext restore/DPR3→cap2 PASS。最終hosted未完了 |
| Stage B分離 | reactionStep、29 rules、384 candidates、Issue #352 step-local geometry cache、fixed step/chemistry/saveを変更しない | 複数旧候補でstrict Stage B PASS。最終候補未完了 |

数値fit/tuple partition/UIは既存 `src/reaction-lab-polymer-presentation.js` へ置き、viewerへ接続する。新規2moduleを追加した最初の候補はmoduleFetchCount148でFAILしたため、既存moduleへ統合し353 assets/146 module fetch契約を回復した。比較用Core API `comparisonEvidence()` は実byproduct graphのcloneだけを返す。化学graph、保存schema、reaction progression、Sample identityを変更しない。

原料は同batchの実source mesh移管前のpose/graphを保存し、after/waterとtuple partitionを検証する。未取得poseを合成しない。水は別group。PEOの元三員環と開いた実graph、PFの実二環と独立4環/3橋の図鑑motifは別identity/stateで表示する。PF L2は未評価のまま。

比較描画でaxisをlane loop内でnormalizeして2本目以降の長さを1にしていた問題も修正した。全laneを実結合長で球内まで接続し、fit後にcamera facingを更新する。refitでgeometryは再生成しない。単体testは長さ・offset・end-on fallback・geometry再利用を検証する。

静止Sampleの同一GPU submissionを省略する。実RAF、全fixed step、completion timer、動的分子、animation、比較画面のrenderは継続する。revision変更は直ちに描画する。`staticFrameSkips`/`renderSubmissions`で観測できる。single-only graphの純group移動ではlane transform計算を省略する。これを性能PASSとはまだ扱わない。

## 確定したブロッカー

### 実PET入力に対する保護されたgeometryの拒否

Source `6400361c5bc813cd098a038de7883df4692b36ef`、run39544766886/job119040316034、artifact12322320528（[hosted job](https://github.com/miyatayuuma/molecule-craft/actions/runs/39544766886/job/119040316034)）。実25ルート連続実行の11番目PETで、`displayGraph.layoutUnitCount=null`となり停止。これはcamera fitの失敗ではない。最初の2回の記録で「fit null」と解釈した説明は撤回した。

[実入力](polymer-local-fragment-task5-evidence/hosted-pet-failure.json)のSampleは `polymer-sample-11-11`、graph SHA256 `ac71c980c5105222e7d2b217da840d403c89349a278f8d18716862ba293d5d1e`。360×780/DPR1/normal。実source tuplesはTPA42/EG41/TPA44/EG43。全source座標が有限で、missing/degenerate sourceは0、47atoms/48bonds、160反復後のcarbonyl `[33,0,2,34]` 平面偏差 `.08718094014457851 > .08`。長さ/角度/steric違反は0。`createSafePolymerFragmentPlan`も同じ診断で `POLYMER_GEOMETRY_UNAVAILABLE` を返す。

再現:

```sh
node scripts/replay-polymer-task5-captured-input.mjs
```

現状exit1、`test-results/reaction-lab-polymer-simplification/captured-input-replay.json`へ全診断を保存する。sample/sourceは不変。geometry module SHA256 `96b87ff09ca838113a5c885c3b3b20f1c959f6199dd54320ab51f7ab3f51e687` はTask④/mainと同一。異なるcanonical fixtureで25/25がPASSする事実はこの実入力を保証しない。

制約順序の最小候補を一時ファイルで比較したが、元のPET/Nylon fixtureを退行させ、実入力も不合格だったため採用しなかった。Task④の閾値、160反復上限、診断、fallback契約、XYZ出力を変更していない。最小再開地点はこの保存済み入力で、既存25ルート/全中間commitと同時にgeometryを合格させる限定修復。これがPASSするまで高コスト12視覚jobsは依存gateで停止する。

別途、ローカル公式Headless Shell156/360×780の連続診断ではPET manual step2が `no-dock-pose` で停止した。[失敗状態](polymer-local-fragment-task5-evidence/local-pointer-pet-failure.json)を保持する。単独PETは同viewportでPASSしたが、連続失敗を無効にしない。CJK fontがないローカルPNGは日本語組版の受入証拠には使わない。

### Finite RAF性能

`d2029ff` はmodule preflightでFAIL。統合後の `1daf130` はmodule preflightを通るがmobile normal/reducedのP95/maxがFAIL。`6400361` も4条件のいずれかのRAF gateがFAILし、[全比較結果](polymer-local-fragment-task5-evidence/finite-6400361-comparison.json)を保持する（run39544766886/job119040315862、artifact12321419875）。650/250ms clockとcompletion latencyは別項目としてPASS。static GPU submission削減を入れた `c7cdb5d` の測定は待機中で、改善を認定しない。

固定baseline `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`、warm-up/trial数、29 rules/384 candidates、8.333333333333334ms strict budget、real RAF、comparator/受入閾値は変更していない。失敗trialの除外、synthetic frames、screenshot/readbackの性能window混入はない。Stage B固定stepとThree.js RAFは別の指標。

## PR #345・review・統合

PR #345はOPEN/unmerged、head `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`。既存canvas高さ変更/GPU同期の証拠を参照し、Task⑤へfooter予約と同寸法buffer更新禁止を実装した。他の変更をmergeしていない。

GitHub Codex独立reviewは、比較close/reopenのstate不一致、比較resize未fit、比較から隠れたbyproduct/shared cameraへpointerが漏れる3件を指摘した。3件とも修正コードと実イベント検証を追加。最終HEADのreviewと全条件CIは未完了で、重大指摘なしの最終認定をしない。

main merge/post-mergeはNOT_EXECUTED。Task⑥への正当な引継ぎは実機端末、児童観察と教育protocol。上記geometry/Finite/all25/最終reviewの未達をTask⑥へ移してCLOSEDにしない。PF L2は別の化学評価課題として残す。
