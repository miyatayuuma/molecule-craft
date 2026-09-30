# Molecule Craft code map

この文書は、変更対象から読むべきファイルを絞るための現行コード地図です。通常タスクでは、ここから対象ファイルと直接import先だけを開きます。

## 最初の振り分け

| タスク | 最初に読むファイル | 主な回帰テスト |
|---|---|---|
| 探索物理・推進・DUST EATER | `src/veil/engine.js`, `src/veil/config.js`, `src/veil/growth.js` | `expedition-core.test.mjs`, `veil.test.mjs` |
| マップ・塵・流れ | `src/veil/map.js`, `src/veil/universe.js` | `growth.test.mjs`, `veil-playthrough.test.mjs` |
| 探索描画・HUD・音 | `src/veil/renderer.js`, `src/veil/ui.js`, `src/veil/audio.js`, `veil.css` | `veil-ui-check.mjs` |
| 探索資源・タンク・帰還・保存 | `src/veil/resources.js`, `src/veil/supply.js`, `src/veil/growth.js` | `supply-tanks.test.mjs`, `expedition-core.test.mjs`, `veil-reset.test.mjs` |
| 分子のゲーム用役割・性能バランス | `src/veil/molecule-roles.js` | `molecule-roles.test.mjs` |
| BASE STOCK入出庫・原子追加/削除/片付け | `src/craft-workspace.js` | `craft-workspace.test.mjs`, `veil-ui-check.mjs` |
| Reaction Lab Chamber UX / discovery / polymerization / feed batches / presentation | `src/reaction-lab-viewer.js`, `src/reaction-lab-discovery.js`, `src/reaction-lab-environment.js`, `src/reaction-lab-presentation.js`, `src/reaction-lab-polymerization.js`, `src/reaction-lab-polymer-presentation.js`, `src/reaction-lab-batch.js`, `src/reaction-lab-manipulation.js`, `src/reaction-graph-edits.js`, `src/reaction-lab-core.js`, `src/reaction-lab-stage-a.js`, `src/reaction-lab-stage-b.js` | `reaction-lab-discovery.test.mjs`, `reaction-lab-polymer-discovery.test.mjs`, `reaction-lab-polymerization.test.mjs`, `reaction-lab-polymerization-fixtures.test.mjs`, `reaction-lab-environment.test.mjs`, `reaction-lab-core.test.mjs`, `reaction-lab-presentation.test.mjs`, `reaction-lab-batch.test.mjs`, `reaction-lab-manipulation.test.mjs`, `reaction-lab-stage-a.test.mjs`, `reaction-lab-browser.test.mjs`, `reaction-lab-polymer-browser.test.mjs` |
| Pairwise reaction rules / contact / DB product resolution | `src/reaction-lab-core.js` | `reaction-lab-core.test.mjs` |
| クラフトのボタン・パレット操作 | `src/craft-controls.js` | `source-contracts.test.mjs`, `mobile-ui-check.mjs` |
| クラフト情報・構造一覧・完成表示 | `src/craft-panel.js` | `source-contracts.test.mjs`, `mobile-ui-check.mjs` |
| クラフトと図鑑・探索の接続 | `src/craft-connections.js` | `source-contracts.test.mjs`, `veil-ui-check.mjs` |
| 結合操作・branch tear-off | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js`, `src/craft-tearoff.js`, `src/craft-detached-drag.js` | `bond-state.test.mjs`, `craft-tearoff.test.mjs`, `craft-detached-drag.test.mjs`, `mobile-ui-check.mjs` |
| 3D配置・補正 | `src/conformation-engine.js`, `src/structure-relaxation.js`, `src/structure-motion.js`, `src/structure-settlement.js` | `conformation-regression.test.mjs`, `structure-relaxation.test.mjs` |
| 分子変形・単結合回転 | `src/conformation-engine.js`, `src/torsion-model.js`, `src/workspace-view.js` | `conformation-regression.test.mjs`, `structure-edit.test.mjs`, `mobile-ui-check.mjs` |
| 制作フィールド保存 | `src/workspace-save.js`, `src/workspace-persistence.js`, `src/workspace-migrations.js`, `src/veil/resources.js` | `workspace-save.test.mjs`, `workspace-persistence.test.mjs`, `veil-reset.test.mjs` |
| 図鑑・発見・解放 | `src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js`, `src/encyclopedia-molecule-transition.js` | `collection.test.mjs`, `collection-expansion.test.mjs`, `collection-polymer-browser.test.mjs` |
| 高分子catalog・route・独立保存 | `src/polymer-catalog.js`, `src/polymer-encyclopedia.js`, `src/polymerization-routes.js`, `src/polymer-collection-state.js`, `src/polymer-collection-persistence.js`, `data/polymers.json`, `data/polymerization-routes.json` | `polymer-catalog.test.mjs`, `polymerization-routes.test.mjs`, `polymer-collection.test.mjs`, `polymer-collection-persistence.test.mjs` |
| PWA・更新 | `src/pwa.js`, `sw.js`, `scripts/build-precache.mjs` | `pwa.test.mjs` |

## アプリ入口

- `index.html`：本番DOM。読み込むアプリ入口は固定名の `src/app.js`。
- `src/app.js`：固定entrypoint。Three.jsシーン、3D入力、結合・構造変形、制作目標のライフサイクルと起動順を担当する。
- `src/craft-workspace.js`：BASE STOCKとの原子入出庫と、制作グラフの追加・削除・全片付け・整理復元。`addPart` は解放確認・一括仮出庫を担当。
- `src/craft-controls.js`：クラフト画面のDOMイベント登録。
- `src/craft-panel.js`：分子情報、制作目標、構造一覧、完成表示。補給目的の反復クラフト操作は持たない。
- `src/craft-connections.js`：探索UI・進捗初期化・図鑑遅延読込・保存ライフサイクルの接続。
- `styles.css`：クラフト・図鑑・共通UI。
- `veil.css`：探索画面と推進UI。
- `src/pwa.js`：PWAインストール、更新通知、安全な再起動。

`src/app.js` は各小モジュールを組み合わせて起動します。分子DB読込後の `collection-ui.js` 遅延importは `craft-connections.js`、図鑑模型の遅延importは `collection-ui.js` が担当します。

## 探索ゲーム

| 領域 | 担当 |
|---|---|
| バランス定数 | `src/veil/config.js` の通常飛行・EXPEDITION・音設定 |
| 分子の役割と領域 | `src/veil/growth.js` のBURST/DRIVE共通動作、領域境界、次目標 |
| 分子役割・性能値・分子別容量 | `src/veil/molecule-roles.js`。化学DBとは分離したゲーム値。coolantを含む4タンクが稼働 |
| 探索物理・推進 | `src/veil/engine.js` |
| DUST EATER | 状態・追跡・捕獲は `engine.js`、描画は `renderer.js` |
| CHO最終地点・遠征中の到達判定 | `src/veil/cho-campaign.js`。クリア確定は `resources.js` の正常帰還精算 |
| 遠征テレメトリ | `src/veil/telemetry.js`（`?expeditionDebug=1`時のみconsole出力） |
| マップ骨格 | `src/veil/map.js` |
| C/O領域・塵・流れ | `src/veil/universe.js`, `expedition-challenges.js`（任意難所・報酬） |
| 酸素の分岐・逆流・静かな渦 | `src/veil/oxygen-routes.js`。物理・描画・補給見取り図の共通定義 |
| Canvas描画 | `src/veil/renderer.js` |
| 画面統合・入力・帰還 | `src/veil/ui.js` |
| 音 | `src/veil/audio.js` |
| 原子・分子・レシピ・積荷・精算 | `src/veil/resources.js` |
| 収集殻・用途別タンク選択・3D模型・図鑑導線 | `src/veil/supply.js` |
| タンク用途・汎用推進計算 | `src/veil/growth.js`, `src/veil/molecule-roles.js` |
| タンク内容・ロードアウト自動錬成・旧在庫移行 | `src/veil/resources.js`, `src/veil/supply.js` |
| 収集殻の共通描画 | `src/veil/collector-shell.js` |
| 全体／カテゴリ初期化 | `src/veil/reset-ui.js`, `src/veil/resources.js` |

探索の現行ルールと意図は `docs/hco-growth.md` にあります。探索だけの変更では、分子DBや生成済みSVGを読む必要はありません。

## Reaction Lab generic core and polymer foundation

Production Reaction Labは `src/reaction-lab-viewer.js` の独立3D sandboxと、Three.js非依存のcompiled authority `src/reaction-lab-core.js` で構成されます。`src/reaction-lab-authority.js` が24個のgeneric Reaction Site Patternと11個のReaction Family（semantic atom labels、encounter / supplemental roles、family-level distance windows、declarative graph edits）を所有し、`src/reaction-lab-catalog.js` が⑦Aで確定した29 concrete reactionsの唯一のchemical source of truthです。Concrete ReactionはDB reactants/productsとenvironment conditionsを定義します。初期化時にlabelled pathways・symmetry classes・strict product mappingsをcompileし、commit時の `planReactionExecution()` がreaction/pathway・participants・matched sites・products・consumed IDs・`atomOrigins`・`graphTransition`・`graphDiff`を確定します。Productionとtestsは同じcatalog sourceをcompileし、test-only migration digestとmanifestが移行後のdriftを検出します。Presentationはchemistryやatom mappingを再判定せず、この確定結果を表示します。Polymer catalogと説明は通常のmolecule catalog / graphと分離し、`data/polymers.json` と `data/polymer-encyclopedia.json` が所有します。

`tests/fixtures/reaction-lab-chemical-candidate-authority.json` と `reaction-lab-structural-exposure-resolutions.json` はtest-onlyの⑦A admission / ⑦D coverage oracleです。Production catalogをfixturesから生成しません。coverage auditのstructural exposure generatorはgeneric patternとfamily editsの露出を列挙する監査器で、chemical candidate generatorやPLAYABLE判定器ではありません。新規・古い・重複resolutionは同じDB-wide testで失敗します。

高分子化は⑦の29反応catalog・24 generic site patterns・Stage Bへ追加しません。`data/polymerization-routes.json` と `src/polymerization-routes.js` が25 exact-Feed route、工程条件、専用site patternを所有します。Three.js非依存の `src/reaction-lab-polymerization.js` が有限のatom graph、source atom分割、副生成物、completion evidenceを検証し、`src/reaction-graph-edits.js` は分子Coreと高分子Coreが共用するguarded graph編集primitiveです。高分子はmolecule DB、Stage B bodies、molecule product validatorへ入りません。

`src/reaction-lab-viewer.js` はexact routeをbatch単位で所有し、実monomerのpointer dockingをfixed-step dwellでcommitします。高分子断片はStage B population外の `PolymerSample` として残り、`src/reaction-lab-polymer-presentation.js` の同一graph-derived layoutがlive Sample Bayと生成SVGの表示を決めます。次FEEDは旧分子、副生成物、PolymerSampleを共通purge transitionで排出します。`src/reaction-lab-discovery.js` がPolymerSample登録とpresentation-readyを別イベントで処理し、Collection reveal brokerを分子・高分子で共有します。

高分子図鑑の25 stable entriesは `data/polymers.json` と `data/polymer-encyclopedia.json` が所有します。画面と発見状態は `src/collection-ui.js` と `src/polymer-collection-state.js`、保存は既存分子Collection schemaと独立した `src/polymer-collection-persistence.js` が担当します。resources collection resetは両Collection keyを処理し、future polymer schemaは保護します。Polymer Core/route/graph・discovery・persistence・mobile pointer testsは `tests/polymerization-routes.test.mjs`, `tests/reaction-graph-edits.test.mjs`, `tests/reaction-lab-polymerization*.test.mjs`, `tests/reaction-lab-polymer-discovery.test.mjs`, `tests/polymer-collection*.test.mjs`, `tests/collection-polymer-browser.test.mjs` が担当します。

`src/reaction-lab-environment.js` owns the immutable `{light, heat, medium}` Chamber state, the neutral/acidic/basic medium, and normalized `light` / `heat` / `acidic` / `basic` tokens. It is independent of molecules, physics, and reactions. Core validates reaction gates against the twelve canonical states, including acidic/basic exclusivity; extra active conditions remain allowed, and overlap arbitration uses the same state domain. Environment changes do not reset every contact: fixed-step candidate eligibility clears only a candidate that no longer matches. Commit copies a frozen environment snapshot into the execution and product event. LIGHT / HEAT / medium affect eligibility only and never enter Stage B physics.

`src/reaction-lab-batch.js` は `activeSlots` / `draftSlots`、`IDLE` / `FLUSHING` / `FEEDING` / `ACTIVE` phase、およびgeneration tokenを所有します。FEEDだけがbatchをcommitし、CRAFT側の原子・BASE STOCKを消費せず、完成分子inventoryも作りません。old batchはproduction physicsから外れてpurgeされ、new batchは既存Stage B rigid-body physicsへhandoffします。reactant consumption後もproductはcurrent batch instanceとして残り、slot changeによる自動補充はしません。picker表示中とLab close中はsimulation clockを停止し、batchとdraftはreopenまで保持します。page reload用のReaction Lab save schemaはありません。

Reaction readinessはnormal Stage B fixed step後にactual 3D atom-distance window、canonical severe-overlap veto、environment gate、participant stateを評価します。Dwellはcompleted NORMAL fixed-step timeだけで進み、production authorityは `src/reaction-lab-core.js` の `CONTACT_DWELL_MS = 1000 / 60`（約16.67 ms）です。ready candidatesはparticipant instanceのoverlap graphでconnected componentsに分け、component内だけgeometry fit・atom continuityでarbitrateします。参加者が独立したreaction同士は競合せず、複数成立時はstable component keyで1件ずつpresentationします。`reserveParticipantInstances()` が実在するparticipantsをまとめてreserveします。Dwell・candidate・presentation途中のconfigurationはnonbonded forceを変更しません。旧H-bond tracker / occupancy / rebinding / persistent H-bond line stateはありません。

Commit後のTransformationはbatch phaseから独立した `PREPARING` / `TRANSFORMING` / `SETTLING` stateで動きます。参加moleculeのStage B bodiesをintegrationから外してsource atom spheresを保ち、非参加batch bodiesはStage Bを継続します。product topologyへCoreのatom mappingとsource world coordinatesをseedして既存preview / structure solverでprivateにtarget geometryを用意し、失敗時はcanonical previewをsource positionsへproper rotation + translationでfitします（reflectionとscaleなし）。共通smooth progressでatomsをmorphさせ、Core `graphDiff`に従ってpersistent / broken / formed / bond-order-change lanesを同時に表示します。aromatic ring・distributed bonds・formal chargesは既存 `aromatic-rendering.js` / `special-bonds.js` grammarを使い、mechanism、intermediate、energetic FXは作りません。通常durationは1200 ms（prepare 120 / transform 850 / handoff 230）、reduced motionは220 ms（30 / 140 / 50）です。close / hidden中はpresentation clockをpauseします。

Handoffではexisting production Stage B read-only pair safety evaluatorを使い、product同士とnon-reacting batch moleculesとのpair safetyを調べます。unsafe時はgeometryから決めた方向へproduct rigid bodyだけを最小限移動し、bystandersを動かさず、unsafe poseをStage Bへ登録しません。product runtime bodyのnonbonded parameters・mass / inertia・carbonyl anisotropy / virtual sitesはcanonical product recordからfreshに作り、source atom velocitiesをmapped atom continuityからrigid-body motionへfitします。final presentation coordinatesをprepared runtime layoutへ渡してsame-frameにvisual ownershipを切り替え、reactantsを取り除いたhandoff後にのみ一度 `molecule-craft:reaction-lab-product` をemitします。eventのproducts順・重複を保ち、各runtime productを `productInstances` IDで識別します。app-level `src/reaction-lab-discovery.js` はpayload全体をpreflightし、product event順でunique speciesをcanonical `collection.registerDiscoveredMolecule()` wrapperから即時登録します。first-registration対象がある場合はLab dialogを一度閉じ、canonical Collectionの同一sessionで順次revealしてから一度再openします。Collection presentation中はviewerの既存 `!dialog.open` tick境界でsimulationが停止し、runtime product / batch / environment stateを保持します。Collection stateが発見・motif・part unlock authorityであり、この経路からResources / FIELD progressionは更新しません。

Production physics authorityはcanonical q / σ / ε、stateless Coulomb + Lennard-Jones 12-6、rigid-body dynamics、carbonyl local multipole qA=0.15 eです。RL-NB6はscalar real-site traversal・transformed-site / LJ-mixing caches・lazy overlap fallback・direct Stage B virtual-site evaluation・precomputed body-space inverse inertiaでperformance gateを通します。Stage B physics-only auditと⑦CのReaction Lab browser auditは別々にp95を測り、後者はviewerのfixed step全体（Stage B + 29-rule candidate matching / geometry / arbitration）を8.333 ms budgetと比較します。`?reactionLabTest=1&reactionLabPhysics=stage-a` はlocalhost比較probe、`?reactionLabPhysics=stage-b` はproduction-equivalent probeです。旧RL-1H force/state authorityとruntime interaction-charge derivationはretiredです。

Chamber camera orientationはinitial perspectiveに固定し、24px acquire / 40px release hysteresis、camera-forward automatic depth docking、45ms docking interpolation、pinch / desktop-wheel zoom、0.15 manipulation slow-timeを維持します。manual camera orbit / pan / molecule rotationはありません。drag targetはprojected real-atom geometryで決まり、release後はXYZ自由Stage B dynamicsへ戻ります。`src/reaction-lab-manipulation.js` がscreen-geometry acquisitionとgeometry-first depth candidateを所有します。release前にdragged bodyとtarget bodyの相対outward accelerationをread-only production Stage B query (`createStageBPairSafetyOracle` / `evaluateStageBPairForcesReadOnly`) でglobal `MAX_DOCK_RELEASE_SEPARATION_ACCELERATION` 以下か確認し、retained front/back branch上の最初のsafe depthを選びます。queryはcanonical q / σ / ε、nonbonded virtual charges、qA=0.15 carbonyl chargesを含み、production bodyをmutateせずequilibriumやreaction dataを参照しません。bounded range内にsafe depthがなければtargetを保持し、visual-contact fallbackはしません。global release checksは3-step / 8-step separation increaseを0.05 Å / 0.12 Åに制限します。`scripts/audit-reaction-lab-docking.mjs` は旧visual-contact poseと新endpointを同じStage B evaluator / fixed-step release trajectoryで比較します。
Current FIELD developer map は `scripts/export-field-map.mjs` が現行 `src/veil/` 実装から `docs/maps/current-field.svg` を生成するdeveloper-only資料です。再生成は `node scripts/export-field-map.mjs`、freshness確認は `node scripts/export-field-map.mjs --check`。FIELD runtime / PWA配信物ではありません。

FIELD expansion proposal map は `scripts/field-expansion-proposal-data.mjs` が座標・gate・density・thermal・challenge・signalのdeveloper-only design intentを所有し、`scripts/export-field-expansion-proposal.mjs` が `docs/maps/field-expansion-proposal.svg` を生成します。`current-field.svg` を同一viewBoxの薄いCURRENT referenceとして重ねるだけでproduction `src/`からはimportしません。再生成は `node scripts/export-field-expansion-proposal.mjs`、freshness確認は `node scripts/export-field-expansion-proposal.mjs --check`。このSVGとdataは後続FIELD実装のdesign sourceであり、現在のgameplay実装を示すものではありません。

## クラフト

| 領域 | 担当 |
|---|---|
| BASE STOCKから取り出す／戻す | `src/craft-workspace.js` |
| 原子・部品の追加、個別削除、全片付け、整理と復元 | `src/craft-workspace.js`（配置候補の計算と3D反映は `src/app.js`） |
| パレット・構造切替・削除・片付けのイベント | `src/craft-controls.js` |
| 分子名・式・選択情報・構造一覧・完成表示 | `src/craft-panel.js` |
| 図鑑と探索画面への接続 | `src/craft-connections.js` |
| 分子グラフ・式・DB認識 | `src/chemistry.js` |
| 原子価・電子・結合許可・幾何 | `src/bonding-model.js` |
| 電子／原子／結合のポインタ判定 | `src/electron-interaction.js`, `src/gesture-arbitration.js` |
| branch tear-off候補・張力hold/hysteresis・切断後drag | `src/craft-tearoff.js`（純粋graph/gesture logic）、`src/craft-detached-drag.js`（切断時snapshot / pointer offset）、`src/app.js`（model removalとreleaseまでの非interactive presentation） |
| 結合成立時の移動 | `src/structure-motion.js` |
| force/velocity drag・whole-skeleton sway・rigid anchorまでのbalanced multi-torsion path・rollback | `src/conformation-engine.js` |
| 剛体断片・結合長・角・平面・立体反発・環/鎖交差 | `src/structure-relaxation.js` |
| release後の独立座標補正と補間 | `src/structure-settlement.js` |
| rotatable / restricted / locked判定 | `src/torsion-model.js` |
| 表示対象・全体回転・画角 | `src/workspace-view.js`, `src/workspace-model.js` |
| workspace canonical capture / restore | `src/workspace-save.js`。旧schema normalizeとstorage保護は `src/workspace-migrations.js`, `src/workspace-persistence.js` |
| ターゲット分解・実グラフ不足判定 | `src/craft-decomposition.js`, `src/craft-target-satisfaction.js`（対応名のテスト） |
| 部品展開・初期座標 | `src/craft-structures.js` |
| 追加位置 | `src/spawn-layout.js` |
| 芳香環・特殊結合・接続点 | `src/aromatic-rendering.js`, `src/special-bonds.js`, `src/attachment-rendering.js` |

## 図鑑とデータ

- `src/collection-ui.js`：図鑑DOM、データfetch、模型の遅延読込。
- `src/collection-state.js`：発見記録、部品解放、保存互換。
- `src/collection-viewer.js`, `src/preview-model.js`, `src/preview-controls.js`：図鑑3D模型。
- `src/functional-groups.js`：官能基検出。
- `src/collection-catalog.js`：分類と表示名。
- `src/element-progression.js`：元素解放。
- `src/veil/molecule-roles.js`：fuel / propellant / oxidizer / coolant候補とゲーム用性能値。化学的事実DBへゲーム性能を混在させない。

現行データは次の6ファイルです。

| ファイル | 内容 |
|---|---|
| `data/molecules.json` | 142分子の構造DB。通常タスクでは全文を読まない |
| `data/encyclopedia.json` | 142分子・17部品の番号と図鑑文 |
| `data/functional-groups.json` | 24官能基パターン |
| `data/craft-structures.json` | 17部品 |
| `data/polymers.json` | 25 routeの高分子化学catalog。材料性能やgameplay qualificationは含めない |
| `data/polymer-encyclopedia.json` | 高分子25件の独立した一般説明・Chemistry Detail・concepts |

`assets/models/` の159 SVGは図鑑用ゲーム資産です。個別の表示不具合か生成処理の変更でない限り、一覧や中身を読みません。

## 保存

- `molecule-craft.resources.v1`：原子在庫、タンク、レシピ、探索進行、精算、制作の保存元。内部schema v9は次回ロードアウトを保存し、O₂ oxidizer容量は36固定。schema v8からの移行では原子・レシピ・ヒント・タンク・LOADOUT・進行・Rare在庫・workspaceを維持し、旧utility stateを除いて酸素量を36以下へ正規化する。完成分子の中間在庫は持たない。出発確定時にBASE STOCKから不足分だけ自動錬成し、タンク交換・破棄・保存を一括処理する。制作スナップショット上の原子はBASE STOCKから取り出し中として保存する。runtimeの資源・タンク・LOADOUT状態管理は `src/veil/resources.js`、resources schema v1〜v9のvalidation / migrationと破損・未来版保護、current-schema書き出しは `src/veil/resources-persistence.js`。
- `molecule-craft.workspace.v1`：従来workspaceの互換入力。内部current schemaはv2。v1/v2判定・normalize・破損/未来版保護とcurrent-only writeは `src/workspace-migrations.js`, `src/workspace-persistence.js`、runtimeのcanonical capture / restoreは `src/workspace-save.js`。resources初回移行に必要な旧workspace bridgeもこのmigration境界を利用する。
- `molecule-craft.collection.v1`：図鑑・発見順・部品解放。管理は `src/collection-state.js`。
- `molecule-craft.help.v1`：初回ヘルプ既読。管理は `src/game-shell.js`。

保存変更では、未来schemaの非上書き、別タブ競合、初期化途中からの再開、旧workspace移行を維持します。

## PWAと生成物

- `manifest.webmanifest`：アプリ名、scope、アイコン。
- `sw.js`：同一releaseの全資産をSHA-256検証後に切替。
- `src/pwa.js`：Service Worker登録とユーザー操作による更新。
- `scripts/build-precache.mjs` → `precache-manifest.js`。
- `scripts/build-molecule-db.mjs` → `data/molecules.json`。
- `scripts/build-collection-assets.mjs` → `assets/models/*.svg`。

`precache-manifest.js`、`data/molecules.json`、`assets/models/*.svg` は直接編集せず、生成元を変更して再生成します。配信ファイル変更後はprecache生成を最後に実行します。

## テストの対応

| 機能 | テスト |
|---|---|
| 分子認識・結合・特殊結合 | `recognition.test.mjs`, `bond-state.test.mjs`, `special-bonds-check.mjs` |
| 図鑑・部品・元素解放 | `collection.test.mjs`, `collection-expansion.test.mjs` |
| 高分子DB・高分子図鑑model・25 route/sample | `polymer-catalog.test.mjs`, `polymerization-routes.test.mjs`, `reaction-graph-edits.test.mjs`, `reaction-lab-polymerization.test.mjs`, `reaction-lab-polymerization-fixtures.test.mjs`, `polymer-progression-geometry.test.mjs` |
| 高分子発見・保存・Collection UI | `polymer-collection-persistence.test.mjs`, `polymer-collection.test.mjs`, `reaction-lab-polymer-discovery.test.mjs`, `collection-polymer-browser.test.mjs`, `reaction-lab-polymer-browser.test.mjs` |
| 分子のゲーム用役割・性能値 | `molecule-roles.test.mjs` |
| 入力・長押し | `electron-interaction.test.mjs`, `gesture-arbitration.test.mjs`, `hold-action.test.mjs` |
| 配置・補正・torsion | `conformation-regression.test.mjs`, `spawn-layout.test.mjs`, `structure-*.test.mjs`, `*-check.mjs` |
| workspace保存 | `workspace-save.test.mjs`, `workspace-model.test.mjs` |
| BASE STOCK入出庫・制作グラフ操作 | `craft-workspace.test.mjs`, `veil-ui-check.mjs` |
| 探索・成長・資源 | `expedition-core.test.mjs`, `growth.test.mjs`, `veil*.test.mjs` |
| 探索バランスシミュレーション | `expedition-balance.test.mjs`, `scripts/simulate-expedition.mjs` |
| CHO通し進行・クリア保存 | `cho-campaign.test.mjs`, `scripts/simulate-cho-campaign.mjs` |
| 酸素分岐の構成比較・実ブラウザ | `oxygen-routes.test.mjs`, `oxygen-routes-browser-check.mjs`, `scripts/simulate-oxygen-routes.mjs` |
| 本番DOM統合 | `mobile-ui-check.mjs`, `veil-ui-check.mjs` |
| オフライン配信 | `pwa.test.mjs` |
| リポジトリ衛生 | `repository-hygiene.test.mjs` |

通常の回帰は `node --test tests/*.test.mjs`。DOM統合と実Three.jsチェックの実行方法はREADMEと各checkファイル先頭を参照します。
