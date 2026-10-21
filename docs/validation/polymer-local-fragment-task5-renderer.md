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

## 2026-10-21 PET recovery (in progress)

Frozen `300046a` replay FAIL is retained in `polymer-local-fragment-task5-evidence/recovery/pet-before.json`; repaired replay is `pet-after.json`. Input SHA256 stays `82d84eb5181e9f758caf896b1978175e17a9b70ea454179a64bfce3cf15bf4ba`. No graph/source edits.

`node scripts/diagnose-polymer-task5-solver.mjs` instruments a test-only data-URL copy of frozen source. `SOLVER_SOURCE_REF=working-tree` traces the candidate. The compressed `solver-*.json.gz` files retain **all** bond, angle, plane, steric constraints at every outer iteration; baseline also records the final inner sweep after repulsion/angle/ring/plane. No production RAF instrumentation. Three bounded alternatives (`SOLVER_VARIANT=plane-last`, `symmetric`, `distance-plane-symmetric`) were rejected: terminal max plane errors .08469/.10768/.12552.

Root cause: projections are nonmonotone. Frozen input is jointly accepted at outer iterations 54–91; at 160, angle/ring stages still pass but overlapping plane projections change an earlier carbonyl plane (.06887 → .08398), then bond-length projection yields .08718. The stricter optional quality target prevented early termination and the solver discarded all feasible iterates. The repair retains the best **jointly validated** checkpoint under the existing quality objective, continues the original solve, and restores it only when the terminal pose fails the unchanged validator. Selected checkpoint is **64**, max plane .06970964, max angle 8.26286°, max bond error .00772846, steric violations 0. Still 160 iterations. Returned pose is independently validated and fallback remains fail-closed.

`tests/polymer-task5-pet-recovery.test.mjs` is the independent production-input regression, including low-budget failure and rejected fallback. Existing Task4 source/origin/invalid/fallback tests and all 25 geometry tests pass. `xyz-compatibility.json` compares frozen/candidate XYZ for 25 final and 95 intermediate fixture graphs: **0 changed**. Existing accepted terminal coordinates are retained. The new diagnostics field `restoredFeasibleIteration` explains recovery without certifying the tighter quality target.

Sequential docking, full visual acceptance, strict performance and final review remain separate pending gates. The existing repository browser assertion counted the new observation target select as a retired species select; its selector now excludes only `[data-observation-target]`, retaining the species-selector prohibition.

Sequential PET is a separate input-policy defect. The real release instant is retained in `polymer-local-fragment-task5-evidence/recovery/sequential-pet-docking-input.json`: batch11 / incoming TPA44 / manual2, route state WAITING, correct acquired real site, no browser errors. All 15 legacy endpoints failed only the 2.8-world **3D travel** cutoff (14 endpoints were sterically safe). The closest safe endpoint needs 2.908674 world travel, of which 2.886067 is camera depth and only .361939 is lateral. Ordinary depth docking had selected `TPA44|polymer-byproduct:11:1`; it is not the geometry convergence failure. Dense256 diagnostics also found no pose within the old travel sphere. Generic pair oracle reported acceleration 143.9455 <150 at this instant; it belongs to the ordinary molecule/water pair, not the kinematic polymer graph.

The manual endpoint search now bounds travel in the camera plane after both actual-site and pointer 40px acquisition checks. Depth may be solved to the existing actual reaction site; ideal bond distance, per-atom steric veto, manual dwell and fixed-step contracts are unchanged. Automatic paths retain their original distance/path checks. `node scripts/replay-polymer-task5-docking-input.mjs` independently rechecks all endpoint atoms/bond distance from the frozen input (old reachable0, new safe14); it is explicitly not a browser/path PASS. The corrected sequential browser reached `polymer-sample-11-11`, exact original graph digest `ac71c980c5105222e7d2b217da840d403c89349a278f8d18716862ba293d5d1e`, 47/48 atoms/bonds, then next FEED. Full final-source CI remains pending.

Visible header close targets were 40px and the Feed/observation row gaps could be 7/4px. They are aligned with Task③'s 44px/8px requirements; no geometry/camera token changed. The existing numeric fit handles the resulting DOM rectangles.

## Review and formal CI follow-up after `db0fab1d`

The hosted `task5-fit-diagnostic` job119201181136 in run39593845116 passed the frozen replay and all25 sequential actual-pointer/comparison gate. Stage B job119201181502 passed the unchanged immutable baseline,29 rules/384 candidates,four measured trials/original comparator. FIELD run39593845166 passed. These belong to **db0fab1d**, not a later source.

Strict Finite job119201181508 failed. `recovery/finite-db0fab1d-comparison.json` preserves the original comparator output. Mobile normal trial-median P95 increased16.7→33.3ms and max33.4→66.7ms. Desktop normal/reduced max183.4→233.2/216.6ms also failed. Completion clock gates passed; this is not a geometry rejection or Stage B failure. No threshold, duration, warm-up, measured-trial count or sample changed. `presentation-db0fab1d-diagnostics.json` records a separately bounded **non-acceptance** experiment: one warm-up plus one measured run per motion, full Lab render vs test-only omitted Lab render. Reduced completion CPU was at most3.3ms with rendering; omitting Lab submission did not remove stalls. Source inspection then found that CRAFT continued updating/rendering behind the Lab modal. The next candidate adds the existing `reactionLabDialogOpen` flag to CRAFT's existing modal early-return. RAF and Lab fixed-step clocks continue; real-browser render counters verify pause while open and resume on close. **This change is not certified as a Finite performance repair until the original formal comparator passes.** Formal Finite now depends on all12 static jobs, preserving the requested gate order.

The db0fab1d DPR2 static jobs failed at PE wheel input. CDP delivered half the intended DOM delta at cappedDPR2. The harness now scales CDP input by actual canvasDPR and separately asserts one real DOM wheel event of−200, then the original exp(.2) zoom. A DPR2 reduced local replay passed. This fixes the test stimulus; it does not relax the wheel behavior. DPR1 static successes remain historical evidence because later production/review changes require a new source campaign.

A GitHub independent review found another real lifecycle case: before/water/concept→disconnect all slots→emptyFEED ends atIDLE without initializing another polymer batch, leaving independently owned comparison geometry active. `startPurge()` now hides/disposes observation before transferring Sample purge ownership. PF before/water/concept→emptyFEED→close/reopen→real re-FEED passed three local cycles. `comparison-empty-feed-craft-lifecycle-local.json` retains source file hashes and is explicitly diagnostic, not final-source acceptance. All cycles return to69 finite geometries/materials and74 GPU geometries/0 textures, with purge counts0. Post-GC CPU heap increased12,123,476→12,444,852→12,678,428 bytes; cause remains unconfirmed. Independent inspection found no accumulated Core/source/mesh ownership, but **CPU memory non-regression is not certified**. Test-only picker failure trace is bounded32 entries.

The new A10/A11 actual DOM/hit-grid audit caught PF concept text inheriting8px/absolute canvas-hint styles. A local `.polymer-observation-concept p` rule restores14px/1.4 flow text. The audit checks all visible controls with owned panel scrolling,44px hitboxes,8px gaps,14px body/legend text,contrast and overflow. Real PNG remains separate from this numeric audit.

The static harness now drives all40 directions through actual bounded pointer drags, captures every actualPNG and IDmask with source/pose/hash, and checks same-view ring/side-junction/functional-group witnesses, including methylH, aromatic external attachments and amideN–H. Every real nitrile gets a local witness. All-route reset uses the real button and originalq≤1e-5rad/scale≤1e-6/projection≤1px contracts. No witness from an old PAN source certifies the final source.

The Repository validation failures are separately preserved: baseline-control generic release overlap guard failed before its Stage B profile; candidate generic browser reached an obsolete desktop tileheight≥80 assertion while the authorized compact layout uses56px. That assertion now enforces44px hit target plus≥500px desktop canvas height. The LOADOUT browser failed before DevTools startup; bounded stderr/exit diagnostics were added, without retries or longer timeout. Neither is reported as repaired physics or a performance PASS.

Independent read-only review of the follow-up found no new blocking production defect and passed9 source/release/static tests. Its reset-contract test concern was corrected as described above. Final-source CI,12 static results, strictFinite and CPU heap explanation remain required; Draft/Open and main are retained until all mandatory gates pass.

Updated local cheap gate completed all25 actual-pointer routes at360×780 with A10/A11 audit and strict all-route reset (no masks). `recovery/all25-cheap-gate-local-summary.json` indexes all25 graph/sample digests and UI failures0; the compressed browser record is retained. It has no final sourceSHA and is not substituted for hosted final acceptance.25 geometry/observation/static/fallback/release/PWA checks passed;353 precache assets are current.

## Local orbit and bounded heap follow-up after `b57b8bd4`

Hosted run39598918395/job119218116830 passed frozen PET, PF emptyFEED/re-FEED and all25 short replay. Stage B job119218117260 and FIELD run39598918413 passed. The first new static360/reduced/DPR1 job119220708307 failed with exactly the same PE local pointer zoom0.9748015434411476 as the local360/reduced/DPR2 diagnostic. This real failure is retained; the source is not certified.

`recovery/local-focus-before.json` reproduces the cause numerically from the actual PE layout/camera. Local atom1 starts with maxZoomFactor .8403793 (<1); its40-direction minimum sphere depth is−.30256. Only overview previously rejected maxZoomFactor<1. Local fit maximized the selected crop in its initial orientation; later rotation correctly protected the whole graph by shrinking it, violating fixed-scale pointer witness reproduction. The limited repair applies the already-existing full-graph radius/1.12 near/far budget to **initial local scale**. Overview formula, atom coordinates, clipping thresholds and orbit sensitivity remain unchanged. `local-focus-after.json` is a working-tree numeric cause diagnostic, not a b57 raster PASS. Both local0/1 start at maxZoom1, min depths2.825/2.744. The new regression passed25 routes×4 local positions×40 directions; independent review confirmed the repair. A new-source full short gate and raster campaign are still required.

Heap growth was investigated using three fresh-browser PF raw snapshots on b57. `recovery/heap-three-cycle-b57-summary.json` records hashes, sizes and type totals. Total self-size increased568,555B; compiled code accounts for513,964B (90.4%), with InstructionStream+354,240 and TrustedByteArray+90,196. Closure size is constant, object+1,788 and array−3,436. ArrayBuffer, Float32Array, JSArrayBufferData and WebGL buffer/VAO/program/shader counts were fixed in all three snapshots. Independent raw-snapshot review supports bounded renderer resource non-accumulation, **not** a proof of infinite-session heap convergence or a decomposition of JIT vsCDP overhead. Final-source lifecycle QA now retains raw snapshots and a separate type/resource summary; this instrumentation is absent from production and formal performance windows.

LOADOUT startup logs on b57 showed Chrome still alive and first stderr at15.8s while the handshake limit was16s. The one-process readiness bound is now30s; optical assertions are unchanged and no relaunch/retry was added. Local LOADOUT optical acceptance passed with the same assertions. This is a browser-startup budget repair, not renderer or physics evidence. The original failed source/job remains recorded.
