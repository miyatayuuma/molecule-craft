# Task⑤ visual acceptance — BLOCKED

Task③ A01–A15、V0–V8、C01–C09、S10–S16を変更しない。最終候補の全25ルート視覚受入は未成立。数値包絡、test-only ID mask、実browser PNGは異なる証拠である。

## 固定した検証予算

360×780、390×844、1280×800 × normal/reduced × DPR1全25、DPR2はC01–C09/S10–S16の重複を除く16ルート、12jobs。各実sampleでoverview/reset PNG、固定40方向（yaw8×pitch5、roll0、同倍率）、未回復対象がある時だけ実atom+1shellのlocal各40方向、各atomにつき最大1local attempt。全失敗を保存し、良い画像だけを選ばない。PNG/readbackはstrict性能windowの外で実施する。既知の実入力FAILを再現する短いgateを先行させ、未達の重いjobsをPASSとは扱わない。

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
