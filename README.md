# Molecule Craft

ブラウザ上で原子をつなぎ、分子の3D構造を組み立てる化学クラフトアプリです。

## MVP

- H / C / N / O / F / P / S / Cl を配置
- 単結合・二重結合・三重結合
- 原子価のリアルタイム検証
- 3D分子モデルの回転・ズーム
- 分子式の自動計算
- 一部の既知化合物を構造グラフから認識
- 自由制作モード

## 現在の操作モデル

- 元素ボタンで未結合原子を追加
- 不対電子どうしを画面上でドラッグして、単結合・多重結合・環を形成
- 結合可能な不対電子対がある間は結合操作を優先し、閉殻時は原子の取得範囲を広げた骨格調整モードへ自動移行
- 原子ドラッグで局所構造を調整し、単結合は軸回転可能
- 結合後はカメラを固定したまま、結合長・角度・sp/sp²・芳香族平面拘束へ段階的に緩和
- 既知化合物は `data/molecules.json` の構造グラフから認識し、慣用名とIUPAC名を併記

## 検証

`node tests/recognition.test.mjs`、`node tests/structure-relaxation.test.mjs`、`node tests/electron-interaction.test.mjs`、`node tests/gesture-arbitration.test.mjs`、`node tests/source-contracts.test.mjs` で、分子DB・拘束ソルバー・操作裁定・direct-module構成の基本契約を確認できます。

## 起動

ビルドは不要です。HTTPサーバーから `index.html` を開いてください。GitHub Pagesでも動作します。

Three.js は jsDelivr からES Modulesとして読み込みます。
