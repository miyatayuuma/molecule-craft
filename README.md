# Molecule Craft

原子宇宙を探索して元素を集め、3Dクラフトで原子をつなぎ、発見した分子の性質で次の探索能力を変えるブラウザゲームです。ビルド工程のないES Modules構成で、GitHub PagesとPWAに対応しています。

## 現在のゲームループ

1. H VeilからCarbon Drift、Oxygen Surge、Inner Horizonへ続く宇宙を探索する。
2. H/C/Oを積荷として集め、滞在と採集で増えるDUST EATERから帰還する。
3. H₂の短時間BURST、またはCH₄とO₂による長押しCOMBUSTION DRIVEを使い分ける。
4. 帰還した元素で分子を手作業し、発見・図鑑登録・長押し量産を解放する。
5. 新しい推進能力で、より深い領域と高密度資源へ進む。

自主帰還は今回の積荷を100%確保します。捕獲時に失うのは今回の積荷の15%だけで、拠点資源、分子、図鑑、レシピ、恒久進行は保持されます。

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
