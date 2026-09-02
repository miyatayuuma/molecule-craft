# Molecule Craft code map

この文書は、変更対象から読むべきファイルを絞るための現行コード地図です。通常タスクでは、ここから対象ファイルと直接import先だけを開きます。

## 最初の振り分け

| タスク | 最初に読むファイル | 主な回帰テスト |
|---|---|---|
| 探索物理・推進・DUST EATER | `src/veil/engine.js`, `src/veil/config.js`, `src/veil/growth.js` | `expedition-core.test.mjs`, `veil.test.mjs` |
| マップ・塵・流れ | `src/veil/map.js`, `src/veil/universe.js` | `growth.test.mjs`, `veil-playthrough.test.mjs` |
| 探索描画・HUD・音 | `src/veil/renderer.js`, `src/veil/ui.js`, `src/veil/audio.js`, `veil.css` | `veil-ui-check.mjs` |
| 探索資源・帰還・保存 | `src/veil/resources.js`, `src/veil/supply.js` | `expedition-core.test.mjs`, `veil-reset.test.mjs` |
| BASE STOCK入出庫・原子追加/削除/片付け | `src/craft-workspace.js` | `craft-workspace.test.mjs`, `veil-ui-check.mjs` |
| クラフトのボタン・パレット操作 | `src/craft-controls.js` | `source-contracts.test.mjs`, `mobile-ui-check.mjs` |
| クラフト情報・構造一覧・完成表示 | `src/craft-panel.js` | `source-contracts.test.mjs`, `mobile-ui-check.mjs` |
| クラフトと図鑑・探索の接続 | `src/craft-connections.js` | `source-contracts.test.mjs`, `veil-ui-check.mjs` |
| 結合操作 | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js` | `bond-state.test.mjs`, `mobile-ui-check.mjs` |
| 3D配置・補正 | `src/conformation-engine.js`, `src/structure-relaxation.js`, `src/structure-motion.js`, `src/structure-settlement.js` | `conformation-regression.test.mjs`, `structure-relaxation.test.mjs` |
| 分子変形・単結合回転 | `src/conformation-engine.js`, `src/torsion-model.js`, `src/structure-edit.js`, `src/workspace-view.js` | `conformation-regression.test.mjs`, `structure-edit.test.mjs`, `mobile-ui-check.mjs` |
| 制作フィールド保存 | `src/workspace-save.js`, `src/veil/resources.js` | `workspace-save.test.mjs`, `veil-reset.test.mjs` |
| 図鑑・発見・解放 | `src/collection-ui.js`, `src/collection-state.js`, `src/element-progression.js` | `collection.test.mjs`, `collection-expansion.test.mjs` |
| PWA・更新 | `src/pwa.js`, `sw.js`, `scripts/build-precache.mjs` | `pwa.test.mjs` |

## アプリ入口

- `index.html`：本番DOM。読み込むアプリ入口は固定名の `src/app.js`。
- `src/app.js`：固定entrypoint。Three.jsシーン、3D入力、結合・構造変形の統合と起動順だけを担当する。
- `src/craft-workspace.js`：BASE STOCKとの原子入出庫と、制作グラフの追加・削除・全片付け・整理復元。
- `src/craft-controls.js`：クラフト画面のDOMイベント登録。
- `src/craft-panel.js`：分子情報、選択原子、構造一覧、完成表示のDOM更新。
- `src/craft-connections.js`：探索UI・進捗初期化・図鑑遅延読込・保存ライフサイクルの接続。
- `styles.css`：クラフト・図鑑・共通UI。
- `veil.css`：探索画面と推進UI。
- `src/pwa.js`：PWAインストール、更新通知、安全な再起動。

`src/app.js` は各小モジュールを組み合わせて起動します。分子DB読込後の `collection-ui.js` 遅延importは `craft-connections.js`、図鑑模型の遅延importは `collection-ui.js` が担当します。

## 探索ゲーム

| 領域 | 担当 |
|---|---|
| バランス定数 | `src/veil/config.js` の通常飛行・EXPEDITION・音設定 |
| 分子の役割と領域 | `src/veil/growth.js` のBURST、DRIVE、費用、領域境界、次目標 |
| 探索物理・推進 | `src/veil/engine.js` |
| DUST EATER | 状態・追跡・捕獲は `engine.js`、描画は `renderer.js` |
| 遠征テレメトリ | `src/veil/telemetry.js`（`?expeditionDebug=1`時のみconsole出力） |
| マップ骨格 | `src/veil/map.js` |
| C/O領域・塵・流れ | `src/veil/universe.js` |
| Canvas描画 | `src/veil/renderer.js` |
| 画面統合・入力・帰還 | `src/veil/ui.js` |
| 音 | `src/veil/audio.js` |
| 原子・分子・レシピ・積荷・精算 | `src/veil/resources.js` |
| 補給・数量指定量産 | `src/veil/supply.js` |
| 全体／カテゴリ初期化 | `src/veil/reset-ui.js`, `src/veil/resources.js` |

探索の現行ルールと意図は `docs/hco-growth.md` にあります。探索だけの変更では、分子DBや生成済みSVGを読む必要はありません。

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
| 結合成立時の移動 | `src/structure-motion.js` |
| force/velocity drag・whole-skeleton sway・rigid anchorまでのbalanced multi-torsion path・rollback | `src/conformation-engine.js` |
| 剛体断片・結合長・角・平面・立体反発・環/鎖交差 | `src/structure-relaxation.js` |
| release後の独立座標補正と補間 | `src/structure-settlement.js` |
| rotatable / restricted / locked判定 | `src/torsion-model.js`, `src/structure-edit.js` |
| 表示対象・全体回転・画角 | `src/workspace-view.js`, `src/workspace-model.js` |
| workspace保存・復元・未来版保護 | `src/workspace-save.js` |
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

現行データは次の4ファイルです。

| ファイル | 内容 |
|---|---|
| `data/molecules.json` | 162分子の構造DB。通常タスクでは全文を読まない |
| `data/encyclopedia.json` | 162分子・17部品の番号と図鑑文 |
| `data/functional-groups.json` | 24官能基パターン |
| `data/craft-structures.json` | 17部品 |

`assets/models/` の179 SVGは図鑑用ゲーム資産です。個別の表示不具合か生成処理の変更でない限り、一覧や中身を読みません。

## 保存

- `molecule-craft.resources.v1`：BASE STOCKの原子在庫、基地分子在庫、探索用推進タンク、レシピ、探索進行、精算、制作スナップショットの正本。制作スナップショット上の原子はBASE STOCKから取り出し中として保存する。移行と破損・未来版・競合保護は `src/veil/resources.js`。
- `molecule-craft.workspace.v1`：従来workspaceの互換入力。構造スキーマと復元は `src/workspace-save.js`。
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
| 入力・長押し | `electron-interaction.test.mjs`, `gesture-arbitration.test.mjs`, `hold-action.test.mjs` |
| 配置・補正・torsion | `conformation-regression.test.mjs`, `spawn-layout.test.mjs`, `structure-*.test.mjs`, `*-check.mjs` |
| workspace保存 | `workspace-save.test.mjs`, `workspace-model.test.mjs` |
| BASE STOCK入出庫・制作グラフ操作 | `craft-workspace.test.mjs`, `veil-ui-check.mjs` |
| 探索・成長・資源 | `expedition-core.test.mjs`, `growth.test.mjs`, `veil*.test.mjs` |
| 探索バランスシミュレーション | `expedition-balance.test.mjs`, `scripts/simulate-expedition.mjs` |
| 本番DOM統合 | `mobile-ui-check.mjs`, `veil-ui-check.mjs` |
| オフライン配信 | `pwa.test.mjs` |
| リポジトリ衛生 | `repository-hygiene.test.mjs` |

通常の回帰は `node --test tests/*.test.mjs`。DOM統合と実Three.jsチェックの実行方法はREADMEと各checkファイル先頭を参照します。
