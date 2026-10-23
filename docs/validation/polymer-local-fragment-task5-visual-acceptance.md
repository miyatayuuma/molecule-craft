# Task⑤ visual acceptance — BLOCKED

Task③ A01–A15、V0–V8、C01–C09、S10–S16を変更しない。最終候補の全25ルート視覚受入は未成立。数値包絡、test-only ID mask、実browser PNGは異なる証拠である。

## 固定した検証予算

360×780、390×844、1280×800 × normal/reduced × DPR1全25、DPR2はC01–C09/S10–S16の重複を除く16ルート、12jobs。各実sampleでoverview/reset PNG、固定40方向（yaw8×pitch5、roll0、同倍率）、未回復対象がある時だけ既存UIの実atomまたはsemantic group+1shellのlocal各40方向、各実atom anchorにつき最大1local attempt。全失敗を保存し、良い画像だけを選ばない。PNG/readbackはstrict性能windowの外で実施する。既知の実入力FAILを再現する短いgateを先行させ、未達の重いjobsをPASSとは扱わない。

## 現在の証拠

| 対象 | 結果・限界 |
|---|---|
| 全25 graph/origin/Task④ geometry | canonical fixtureのunit suites PASS。保存実連続PETは修復後PASS（db0fab1d hosted先行gate）。元FAIL保持 |
| 全25×3 safe rectangle/48 primary姿勢/reset | numeric PASS。実端ray可視≥.70を追加しPASS。最終browser mask ≥.60未検証 |
| Source640、360 normal最初10ルート | 全atom/bondが40方向＋必要localで回復、A06輪郭/連続lane raster gradingで未回復0。11番目PETで停止。25/25 PASSではない |
| PAN4実C≡N | source640の実PNGとID maskで3lane/2gapを回復。[partial evidence](polymer-local-fragment-task5-evidence/pan-l1-partial.json)。NBRと最終sourceは未完了 |
| Pointer | 旧候補13代表mobile/desktop既存suite PASS。最終ローカル最初10ルートの比較/二指/lifecycle、C01の数値gesture PASS。連続PET manual2と全25短診断はdb0fab1dでPASS。旧FAIL保持 |
| Resize/DPR/context/resource | numeric no-op/cap、ローカルC01 context restore/cap2 PASS。最終全条件と反復memory受入は未完了 |
| UI A10/A11 | 14px/44px実装。全状態のcontrast/overflow/全control grid証明は未完了 |
| Stage B | 旧候補d2029/115ea/1daf/640でstrict PASS。db0fab1d strict PASS、後続source未完了 |
| Finite RAF | d2029 module budget FAIL→修復。1daf/640 strict timing FAIL。db0fab1dでP95/max正式FAILを固定。背面CRAFT停止候補は未認定 |
| FIELD/保存/Collection/Engineering/PWA | 旧候補の専用CI/既存suiteにPASSあり。最終HEAD認定は未完了。353 assetsのlocal整合を再確認する |
| 独立review/main/post-merge | 3指摘修正。最終review/全CI/main merge/post-merge未完了 |

Source640の静的job: [run39544766886/job119040316034](https://github.com/miyatayuuma/molecule-craft/actions/runs/39544766886/job/119040316034)、artifact12322320528。PNG witnessのsource SHA、sample ID、graph digest、viewport/DPR/motion、group/camera pose、state、capture hashをJSONへ保存する。最終候補のwitnessは完全poseとselectionも記録する。diagnostic replayは `DIAGNOSTIC_REPLAY_NOT_VISUAL_ACCEPTANCE` と明示し、local/raster completeをfalseにする。

## V/C/S coverage

| 契約 | 部分確認 | 未達 |
|---|---|---|
| V0 overview/real ends | 最初10の包絡/mesh。実端遮蔽を検出し姿勢選定修復 | 修復後全25 raster/reset |
| V1 主鎖/側基 | PP/PIB semantic選択、origin一致 | 全指定接合＋隣接主鎖の同時回復証拠 |
| V2 環 | PSの4環各6edge同時witness | PET/PFと全V2 route |
| V3 元素/次数 | C/H/O/N/F/Cl凡例、全25 numeric lane、PAN actual raster | NBR/全対象/最終source |
| V4 官能基 | PEO ether/PAAの部分的観察、全25 semantic units | PET/Nylonほか全local witness |
| V5 由来 | 全25 tuple partition単体、最初10の実source比較 | 二原料を含む全状態100%実ブラウザ |
| V6 前後/水 | 最初10 before/after、PEO前環/後open graph、Core water partition単体 | water0/1/3を含む全browser状態 |
| V7 残存C=C | ring外selector実装/単体 | SBR/NBRの実local比較 |
| V8 PF | 実2環と独立4環/3橋の別state/identity実装、L2留保 | PF実browser往復受入 |
| C01 PE / C02 PP / C03 PS / C06 PEO / C07 PAN | 旧候補360 normalで部分raster、ローカル短診断 | 最終3viewport×2motion×DPR |
| C04 PET | 実入力geometry修復と全25短診断PASS | 最終全静的campaign |
| C05 Nylon / C08 SBR / C09 PF | canonical unitのみ | 全静的campaign |
| S10 NBR / S11 PTFE / S13 Nylon / S15 VDF–HFP | canonical unitのみ | 全静的campaign |
| S12 PIB / S14 PCTFE / S16 PAA/PLA | PIB/PCTFE/PAAの旧候補部分witness。PLA未到達 | 全S16と最終全条件 |

L1は「実装修復＋PAN部分raster確認」。NBRを含む最終受入がないためL1全体PASSとしない。物理端末と児童観察はTask⑥ NOT_RUN、PF L2未評価。Task⑤固有の未達はTask⑤のBLOCKERとして保持する。

## 最小再開手順

1. 保存PET replayと25最終/95中間regressionはPASS。元FAIL・投影trace・XYZ差分0を保持し、後続sourceで再検証する。
2. 連続PET manual2は別のcamera-depth探索制限として修復済み。実Sample/graphと次FEEDの一致を後続sourceで再確認する。
3. 最終runtimeを固定し、短い全25実pointer/比較診断→12静的jobs、実pointer witness再現、A10/A11を含む全受入、resource/lifecycleを完了する。
4. strict Stage B/Finite/FIELD/保存/Collection/Engineering/PWA、独立reviewを同じsourceでPASS後にmain merge、post-merge確認。FAIL履歴を除外しない。

## Follow-up candidate contract

後続campaignは、全40方向を実pointerで到達し、全viewの実PNG/IDmaskを保存。同時可視は環＋接続、methylH/接点＋隣接主鎖、amideN–H等を同一viewで判定する。PAN4本/NBR1本は各local witnessと実reset復帰も必要。resetは元のq1e-5/scale1e-6/投影1pxを維持する。

A10/A11の実DOM/hit-grid auditを短いgateにも追加。PF模式図注記の8px継承を検出・限定CSS修正した。比較から空FEEDへ進むresource漏れは独立reviewで修正。PF3cycleのGPU資源は横ばいだがCPU heap増加は原因未確定で、memory PASSにはしない。後続sourceのstrictFiniteは12静的jobs合格後だけ実行する。旧FAIL、旧DPR1部分PASS、DPR2の入力不備を上書きしない。

The b57 final-source short gate and Stage B passed, but its static PE local pointer witness failed at zoom.97480154. The local fit accepted maxZoom<1 while overview rejected it; applying the existing full-radius depth budget at focus time fixes the reproduced numerical cause. No raster PASS is claimed before a new campaign. The bounded heap investigation attributes90.4% of observed self-size growth to compiled code, with measured buffers/WebGL owners flat; final-source raw snapshots and summary remain required.

## 5633 CI and resize follow-up

Source `5633a18d8578ac0b1d326e9fd30f15ff59529813` の [run39600752370](https://github.com/miyatayuuma/molecule-craft/actions/runs/39600752370) は短い全25連続gate・PF3cycle資源・strict Stage BがPASS。Repository/FIELD専用CIもPASS。12静的jobsはdesktop4件がSlot C→FEEDの実hitbox間隔7pxでFAIL、mobile6件が同一viewのgroup/L1 local witness不足でFAIL、390 DPR2の2件が90分でCANCELLED。Finite jobはSKIPPED。[全jobとartifact hash](polymer-local-fragment-task5-evidence/recovery/5633-ci-summary.json)を保持し、正式visual/FiniteをPASSとはしない。

候補は44pxボタンをbar内へ収める46px/縦padding0の限定CSSと、既存semantic group選択を使うlocal witnessを検証中。全要求atomのq≥20と同じviewのatom/bond回復を必要とし、aromaticは実環選択を必要とする。overviewの可視だけではlocal groupを認定しない。

追加reviewのzoom済みresize指摘を実ブラウザで再現した。旧sourceは小wheel後pivotが1.03005 worldずれ、local zoom .904837→1へ戻った。候補はresize時に新fitと表示transformを同期しzoom/orientationを保持。desktopのglobal/local、閉じた間のresize、DPR-onlyで検証中の[原本と差分](polymer-local-fragment-task5-evidence/recovery/zoom-resize-recovery-summary.json)を保存する。これは未commit runtime診断であり最終source認定ではない。

独立reviewで実PNGの旧hintとPURGEの重なりをA10違反と確認。hintをPURGEから8px離すbottom32pxへ限定変更し、実DOMのgap検査を追加した。旧390/DPR2の2jobは固定campaign実行中に90分で中断したため、次回の静的job実行上限だけ180分とする。12job・全40方向・local anchor予算・光学閾値・Finite650/250msとwarm-up/trial/comparatorは不変。先行gateにdesktop全25を追加し、重いjob前に既知の画面外pointer条件も検査する。

今回の未commit runtimeのmobile360/desktop1280全25 actual-pointer短診断は両方完走。PETの同Sample ID/graph、PGAの通常camera回復→実pointer完成、次FEED/purge、比較、厳密resetを確認した。recovery/all25-{mobile,desktop}-camera-summary.jsonと圧縮原本を保持する。最初の25は旧hint位置をロード済みで、hint修復は別PE/DPR2実browser pilotでgap8・UI失敗0・reset差0を確認。最終source全25はCI先行gateで再受入する。

## Optical measurement recovery (not yet final acceptance)

新しいPAN4/NBR1のlocal triple候補PNGとmaskをrecovery/pan-l1-candidate-* / nbr-l1-candidate-*へ保存した。PANは360viewsで7group、NBRは240viewsで3groupが旧predicateのFAIL。さらにA06 graderが2px帯でなく境界の単一点を採点し、黄色selection outlineを混入していた。実同poseのC3はannotated44/45方向、注釈なし25/45方向であり、旧A06 PASSを最終光学根拠に使わない。原本FAILは保存し上書きしない。

修正はtest-only。annotated実PNGを保持し、SVG annotationだけ一時非表示にした同poseの実photometryPNGを別保存、finally元visibilityへ戻す。固定72ray、内側/外側2CSSpx帯のmean linear luminance、delta.05・75%・白clip30%は不変。DPRの各physical pixelを帯に含める。実PNG fixtureで注釈による偽PASSを拒否し、別poseの同じCが無注釈で合格する回帰2件を追加した。

独立reviewでA07表の同時条件はA03/A04、A06は指定球の独立光学条件と確認。全atomのA06 coverageを保持し、同一group viewで全近傍atomのA06まで同時成立させていた過剰な結合を分離した。view.visibleAtomsはA03、atomWitnesses/missingAtomsは各atomのA03+A06を検査する。DOM equipment/hint/PURGEとSVG circleの実occlusionも保存し、maskの背後を実可視と数えない。各C≡Nは実carbon atom選択で既存local shellへ到達し、同じ40方向/最大1anchor予算で検査する。

保存PNGの読取診断は `node scripts/diagnose-polymer-task5-raster.mjs <route-evidence-directory>`。geometry/pose/cameraからの投影が初期実snapshotと1e-6以内で一致することを先に検査し、actual/maskを同じgraderで読む。正式性能windowには接続しない。測定修正後のNBR/PAN pilotと最終source campaignは未認定のまま。

NBR/PANのscope/遮蔽pilotで全atomのA06、全groupの同時A03/A04、実triple localは取得できたが、single-route checkerでNBR初期端20のmask可視率.549がFAIL。予測64ray .734（dense16384 .762）と差があり、AA maskのID混色をexact-color計数が捨てている可能性を短診断で調査中。NBR原本とgateFAILはrecovery/nbr-occlusion-before-mask-*へ保存。12jobは既知FAILの解消前には開始しない。

## Latest candidate pilot result

NBRのAA IDmask FAILを保存後、同じ投影（差1.26e-8px）でsamples0 sRGB object-ID attachmentを検証。端20 exact-ID画素260→288、可視率.549→.608、端0 .728→.768。独立reviewで混色451色→69色とresource復帰を確認。表示用MSAA/材質/graph/poseは不変で、IDmaskだけがtest-only単一sampleとなる。

修正を含む最後の実browser pilotはNBR160views・PAN360viewsでsingle-route checkerの全条件PASS。全atom独立A06・全bond・同時group・PAN4/NBR1のtriple local・初期両端・UI・実resetがPASS。annotated PNG、無注釈photometry PNG、maskを別hashで保持した。recovery/pan-nbr-id-buffer-pilot-summary.json、*-id-buffer-pilot.json.gz、*-pilot-gate.json、*-l1-id-buffer-*.pngを参照。runtime SHA256を保存した候補診断であり、最終source全25/12job/DPR2/strictFiniteの代用にしない。

## Final-source先行gate 239624

HEAD `239624dbf6ec1985a37233a60748c41461b285e6` のrun39708513297は、保存PET replay・実PET・PF3cycle resource・mobile全25 actual pointer/比較がPASS。Repository run39708513226とFIELD run39708513252、strict Stage BもPASS。desktop先行gateはPEの閉じる/Slot C間隔7.5pxでFAILし、12静的jobs/FiniteはSKIPPED。原本report/PNGとartifact digestを `recovery/239624-*` に保存した。親 `.reaction-lab` に残ったdesktop gap7pxを8pxへ揃える限定CSS修正を行い、新sourceで先行gateから再検証する。閾値やhit gridは変更しない。

## 5f344 resource判定の修復

run39738710682/job119690461800は保存PET/実PET/PF lifecycleがPASSした後、heap集計でFAIL。原本 `recovery/5f344-heap-failure.json` のobject ArrayBufferは75→73→73個、native backing bytes951124→950292→950292であり増加ではなかった。測定resourceの完全一致assertが解放による減少まで拒否していた。原本とexact type/name/self_size node projection（元heap hash付き）を保持した。

集計は全差分を保存し、各隣接cycleのcountまたはself_size増加だけを0許容で拒否する。減少後の新規1個増加、同countで8bytes増加のnegative controlを含む3回帰がPASS。GPU/mesh/materialの別の完全一致assertは不変。総heapの長期収束や正式性能改善は引き続き未認定。旧FAILを上書きせず、新sourceで先行gateから再検証する。

## Heap観測境界の正規化

0c972 run39739683129/job119693620634は75→73→75 buffersで増加gateがFAIL。元summaryとartifact hashを `recovery/0c972-heap-failure.json`、独立owner診断2件を同recoveryへ保存した。416byte sigma/epsilon cacheのpairは各cycleの現source6–9/11–14/16–19だけに属し、旧cycleキーは未検出。FEED handoffと初期phenol消費のframe境界により、ready時点でそのpairを既に評価した履歴が異なる構造である。原本だけから特定frameの履歴までは断定しない。

比較状態を同じにするため、heap採取を各cycleの空FEED完了後へ移す。IDLE、transitionなし、instances/purge/reserved0、sampleIdなしを実snapshotでassertし、採取stateを保存する。再構築後のGPU/mesh/materialは従来通り完全一致、CPU資源の増加許容0も維持。production cache/physicsは変更しない。この候補の実ブラウザ確認は次source CIで行い、未実行の12静的jobs/strictFiniteはPASSにしない。

## 50c0正式FAILの保持と限定修復

Source `50c0b38fba2ad87272d30a536d45a1060a80c7a0` のrun39740905764は保存PET・実PET・mobile/desktop全25短診断とStage BがPASS。固定12静的jobsは10 FAIL/2 timeout、FiniteはSKIPPED。Repository/FIELDはPASS。旧Finite db0fab1dのFAILも残し、性能修復成功とは判定しない。

Mobileの同時group視認は未達。限定候補ba94cbはPPでPASSしたが、PIBの接点0/17/30はFAIL。geminal二C/各3Hの同時条件と全実C–Hの検査は維持する。追加のgraph-derived local frameは実graphへの剛体回転だけを選び、geometry・原子・結合・originを変えない。予測scoreは実PNG gateの代用ではない。

ba94cbのPETは比較中resize後の最終resetでFAIL。比較がordinary worldを一時非表示にする間に初期fitのoccluder集合を空へ置換していた。候補はSample完成時の実world atom snapshotを同Sample内で保持し、比較・resize・reopenで再利用。次Sampleはfit=nullから開始し、前Sampleの入力を流用しない。

Desktop元artifact9/10はinspection run39772675225でsource/run/digestを照合して部分抽出した。[保存index](polymer-local-fragment-task5-evidence/recovery/50c0-desktop-inspection-index.json) と圧縮原本・実PNGを保持する。PLA local29/y45/p30は角差.3926989446、倍率1。旧開始点判定の6pxとproduction fallback grab22pxの不整合を修正し、実press直後のSample/orbit/ordinary drag ownerを記録・assertする。旧traceにはownerがなく、過去の取得先instanceは断定しない。40方向・anchor予算・実イベント/角度/倍率gateは不変。

SBR desktop reduced/DPR1は閉じたdialogにgeometry36が残るsnapshotでFAIL。試験側は待機条件に合格したsnapshotをそのままassertへ使い、別CDP呼出しとの間のnative close境界を除く。元2秒上限・geometry/material/activeGroup/atom map assertを維持し、production disposeを変更しない。これは複数cycle資源受入の代用ではない。

4修正の[独立限定review](polymer-local-fragment-task5-evidence/recovery/frozen-fit-pointer-limited-review.json)はblocking findingなし。局所frameのzero/非有限edgeを正規化前に拒否するnegative controlを追加し、関連19 testsとPWA353資産検査がPASS。新sourceは先行全25→PET/PLA対象rasterとPF資源を実行する。既知PIB FAILの同source再実行、固定12件campaign、strict Finiteの成功はまだ宣言しない。Task⑤はBLOCKED、PR #354はDraft/Openを維持する。


## 2026-10-23 thread recovery checkpoint

GitHub authority remains main `593ac571` / PR #354 Draft HEAD `50c0b38f`. Recovered local source `d29a11599c7c71ebb4e2e2824545904272976b23` was not on GitHub at recovery start; preserve it with this checkpoint. The previous hosted run39740905764 finished: Repository/FIELD/Stage B and both short all25 gates PASS, fixed12 raster jobs10 FAIL/2 CANCELLED after timeouts, Finite SKIPPED. No job remains pending in that old run.

The recovered candidate passes31 local tests (no failures/skips), frozen actual PET and docking replays, hygiene0 warnings and353-asset PWA freshness. Fresh official Chrome for Testing156.0.8078.47 with Japanese fonts completed360×780 all25 actual-pointer/comparison smoke, known entry, nextFEED/purge, resource open/close and close-before-ready. Records are `recovery/d29-mobile-smoke.json.gz`; the PET representative is `recovery/d29-mobile-pet.png`. Fixed mask grids were disabled; these are not raster/Finite acceptance. Desktop smoke is running at this checkpoint, not accepted. `recovery/20261023-resumed-state.json` indexes exact source, results and limits.

PIB frozen-input numerical replay retains the old local poses. One bounded exploratory sweep (256 sphere directions×2rolls×3failed sites=1536 fits) predicts scores1/.80235/.53571 for anchors0/17/30; this does not prove impossibility or certify any PNG. Source/graph/geometry/candidate budgets and thresholds are unchanged. Reproduce with `node scripts/diagnose-polymer-task5-directions.mjs`; all observations and input/runtime hashes are retained in `recovery/d29-pib-direction-diagnostic.json.gz`. This diagnostic belongs to the present unresolved visibility work, outside performance windows.

Checkpoint commits use `[skip ci]` to avoid starting additional Actions during this diagnostic checkpoint; this does not waive any hard gate. Final-source raster/Finite/review/merge remain pending, and Task⑤ stays BLOCKED.
