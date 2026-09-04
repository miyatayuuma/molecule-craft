# Molecule Craft

原子宇宙を探索して元素を集め、3Dクラフトで原子をつなぎ、発見した分子の性質で次の探索能力を変えるブラウザゲームです。ビルド工程のないES Modules構成で、GitHub PagesとPWAに対応しています。

## 現在のゲームループ

1. 基地からANCHOR FIELDで採集殻（Collector Shell）を原子宇宙へ展開する。
2. H/C/OをCARGOとして集め、発見した噴射剤のBURSTまたは燃料 + O₂のCOMBUSTION DRIVEを消費して奥へ進む。
3. 0.8秒のANCHOR LOCKを通して安定回収し、帰還した元素から分子を手作業で発見する。
4. 完成模型を設計として、BASE STOCKの原子から探索用タンクへ必要分子を長押し充填し、次の採集殻を展開する。
5. DUST EATERの保持場干渉が迫ったら、BURSTで距離を作って安全な回収時間を確保する。

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
| `data/` | 162分子DB、図鑑文、官能基、部品 |
| `assets/models/` | 162分子・17部品の生成済みSVG |
| `tests/` | 現行仕様の単体・統合・手動確認 |
| `scripts/` | DB、SVG、precache、repository hygieneの生成・検査 |
| `docs/` | 現行アーキテクチャと探索設計 |

タスク別のコードマップは [docs/architecture.md](docs/architecture.md)、探索の現行仕様は [docs/hco-growth.md](docs/hco-growth.md) を参照してください。

## テスト

```sh
node --test tests/*.test.mjs
node scripts/check-repository-hygiene.mjs
```

本番DOM統合試験にはjsdomの実体パスを渡します。

```sh
node tests/mobile-ui-check.mjs /path/to/jsdom/lib/api.js
node tests/veil-ui-check.mjs /path/to/jsdom/lib/api.js
```

実Three.jsを使う追加の幾何検証は `tests/*-check.mjs` にあります。各ファイル先頭の実行方法を参照してください。

## 生成物

- `data/molecules.json`：`node scripts/build-molecule-db.mjs`
- `assets/models/*.svg`：`node scripts/build-collection-assets.mjs`
- `precache-manifest.js`：`node scripts/build-precache.mjs`

生成物は直接編集せず、生成元を変更して再生成します。配信対象を変更した場合は、最後にprecacheを再生成してください。
