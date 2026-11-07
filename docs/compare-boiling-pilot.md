# MC-COMPARE-02｜沸点比較・沸騰観察（3分子試作）

## 試作入口

分子図鑑 → くらべる → `沸点`。パイロットは `?compareBoilingPilot=1` を付けた URL でだけ有効。通常のモル質量・原子数の比較は変更しない。

試作対象: n-ブタン −0.5 °C、エタノール 78.4 °C、水 100.0 °C。NIST Chemistry WebBook SRD69 の常圧沸点に基づく表示値。完全な物性データベースではない。

- https://webbook.nist.gov/cgi/cbook.cgi?ID=C106978&Type=TBOIL
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=6
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4

## 観察の流れ

1. 珠を台座に合わせる。ひも・非固定珠の運動は従来どおりの PBD で計算する。
2. 既発見で沸点が登録されている試料のみ、沸点より 12 °C 低い温度から 2.25 秒かけて上げる。
3. 沸点に達したら約 3 秒数値が止まる。この間に気泡が発生し、球状試料が霧散する。沸点の停滞は液相と気相の共存を説明する演出であり、分子自体の沸騰ではない。
4. 同じ珠にとどまる限り消えたまま。ほかの珠にフォーカスを移したら、前の珠が 1.7 秒ほどで再凝集する。切替後の再選択は可能。

未知の分子には名前・数値・沸点演出を表示しない。既存の発見・セーブ・データ型は変更しない。

## 技術・帰属

- Three.js 既存 r180 の WebGL シーンに統合。
- Three.quarks **v0.16.0**、MIT License、© 2019 Forrest Sun。`vendor/quarks/LICENSE` に原文を保持。`three.quarks.esm.js` を esbuild で一度だけバンドル、Three.js は `external` として import map で共用。エフェクト使用時のみ遅延読み込みする。
- WebGL 非対応・パーティクル読み込み失敗時には数値表示と既存 Canvas rope にフォールバック。
- 泡と霧は低負荷のスプライト粒子、試料は透明なガラス状シェルと対流シェーダー。大規模液体シミュレーション・物理的な気液界面計算ではない。

## 限定検証

`node --test tests/compare-boiling-cycle.test.mjs tests/encyclopedia-compare.test.mjs tests/compare-rope-physics.test.mjs`

ブラウザ試作では、同じ珠を繰り返し自動発火しないこと、切替中に旧珠が復元すること、未知珠の表示、Android の描画負荷を確認する。
