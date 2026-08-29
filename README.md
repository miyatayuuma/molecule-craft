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
- 原子ドラッグで局所構造を調整し、単結合は軸回転可能
- 結合後はカメラを固定したまま、結合長・角度・sp/sp²・芳香族平面拘束へ段階的に緩和
- 既知化合物は `data/molecules.json` の構造グラフから認識

## 検証

`node tests/recognition.test.mjs` と `node tests/source-contracts.test.mjs` で、分子DBとdirect-module構成の基本契約を確認できます。

## 起動

ビルドは不要です。HTTPサーバーから `index.html` を開いてください。GitHub Pagesでも動作します。

Three.js は jsDelivr からES Modulesとして読み込みます。
