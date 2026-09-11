# Molecule Craft

原子宇宙を探索して元素を集め、3Dクラフトで原子をつなぎ、発見した分子の性質で次の探索能力を変えるブラウザゲームです。ビルド工程のないES Modules構成で、GitHub PagesとPWAに対応しています。

## 現在のゲームループ

1. 基地からANCHOR FIELDで採集殻（Collector Shell）を原子宇宙へ展開する。
2. H/C/OをCARGOとして集め、発見した噴射剤のBURSTまたは燃料 + O₂のCOMBUSTION DRIVEを消費して奥へ進む。連続燃焼の熱は冷却剤タンクが自動制御する。
3. 0.8秒のANCHOR LOCKを通して安定回収し、帰還した元素から分子を手作業で発見する。
4. LOADOUTで発見済みの対応分子を各タンクへ選び、出発確定時に不足分をBASE STOCKから自動錬成して搭載する。材料不足時は現行のFULL / PARTIAL / IMPOSSIBLE判定に従う。
5. DUST EATERの保持場干渉が迫ったら、BURSTやDRIVEで距離を作って安全な回収時間を確保する。

ANCHOR LOCK完了後の安定回収は今回の積荷を100%確保します。完了前にDUST EATERが保持場を崩した場合、安全装置が緊急回収し、保持場からこぼれた今回の積荷15%だけを失います。BASE STOCK、タンク内容、図鑑、レシピ、恒久進行は安全です。

## 起動

リポジトリ直下をHTTPサーバーで配信し、表示されたURLの `index.html` を開きます。ローカルファイルとして直接開く構成ではありません。

```sh
python3 -m http.server 8000
```

Three.js 0.180.0は `vendor/three/` に同梱されています。通常起動に外部CDNやパッケージインストールは不要です。

## 現行エントリポイント

- `index.html` — 本番DOMとスタイル・モジュール読込
- `src/app.js` — クラフトを中心とするアプリ統合入口
- `src/pwa.js` — インストール・更新UIとService Worker登録
- `sw.js` — オフラインキャッシュと安全な更新切替

ソースの世代管理はGitで行い、バージョン番号付きentrypointは作りません。

## ディレクトリ

| パス | 内容 |
|---|---|
| `src/` | クラフト、図鑑、保存、共通UI |
| `src/veil/` | 探索、推進、DUST EATER、資源精算 |
| `data/` | 分子DB、図鑑文、官能基、部品 |
| `assets/models/` | 生成済み分子・部品SVG |
| `tests/` | 現行仕様の単体・統合・手動確認 |
| `scripts/` | DB、SVG、precache、repository hygieneの生成・検査と、現行探索バランスの手動評価 |
| `docs/` | 現行設計契約と、明示的な未実装計画 |

## Documentation source of truth

- [docs/architecture.md](docs/architecture.md) — 現行コード責務・保存・テストの対応表
- [docs/game-design.md](docs/game-design.md) — 今後も維持するゲーム設計原則と禁止方向
- [docs/hco-growth.md](docs/hco-growth.md) — 現行H/C/O探索・LOADOUT・推進・帰還契約
- [docs/route-kit.md](docs/route-kit.md) — 探索ルート構築部品の現行契約
- [docs/ui-state-model.md](docs/ui-state-model.md) — 現在のUI状態所有権と未実装の中央調停方針
- [docs/planning/cho-completion-roadmap.md](docs/planning/cho-completion-roadmap.md) — 未完の初見プレイ検証ゲート
- [docs/planning/molecule-craft-astra-direction-brief.md](docs/planning/molecule-craft-astra-direction-brief.md) — CHO後の未実装方向性

`docs/planning/` は将来計画であり、production runtimeの仕様値はsourceと上記現行docsを優先します。完了済みhandoff、PR単位の進捗、過去の比較表はGit履歴・Issue・PRへ残し、main上のsource of truthにはしません。

## テスト

```sh
node --test tests/*.test.mjs
node scripts/check-repository-hygiene.mjs
```

PRでは依存install不要の軽量guardrailとして、repository hygiene、source contract、PWA生成物freshness / integrity、差分whitespaceを自動検証します。precacheを更新すべき変更かだけ確認する場合は、生成物を書き換えずに次を実行できます。

```sh
node scripts/build-precache.mjs --check
```

本番DOM統合試験にはjsdomの実体パスを渡します。

```sh
node tests/mobile-ui-check.mjs /path/to/jsdom/lib/api.js
node tests/veil-ui-check.mjs /path/to/jsdom/lib/api.js
```

実Three.jsを使う追加の幾何検証は `tests/*-check.mjs` にあります。各ファイル先頭の実行方法を参照してください。

## 手動評価tooling

以下はproduction runtimeを変更せず、現行sourceの定数・route・engineを使って探索バランスや設計判断を再現するための手動評価です。

- `node scripts/evaluate-propulsion-profiles.mjs` — fuel response、coolant profile、現行O₂容量36 / 48 / 72での推進差を比較する。
- `node scripts/simulate-expedition.mjs` — 通常・深部・BURST / DRIVE極端運用の収支、危険度、推進コストを決定論的に比較する。`expedition-balance.test.mjs` も同じ評価器を利用する。
- `node scripts/simulate-cho-campaign.mjs` — 新規状態から分子発見、現行LOADOUT出発時自動錬成、CHO最終到達・正常帰還・保存までを機械的に通す。人間の初見プレイ時間評価には使わない。
- `node scripts/simulate-oxygen-routes.mjs` — Oxygen分岐の有限tank・route・loadout・CHO最終遠征を比較する。`oxygen-loadout-evaluation.test.mjs` と `cho-campaign.test.mjs` もこの評価器を利用する。

## 生成物

- `data/molecules.json`：`node scripts/build-molecule-db.mjs`
- `assets/models/*.svg`：`node scripts/build-collection-assets.mjs`
- `precache-manifest.js`：`node scripts/build-precache.mjs`

生成物は直接編集せず、生成元を変更して再生成します。配信対象を変更した場合は、最後にprecacheを再生成してください。
