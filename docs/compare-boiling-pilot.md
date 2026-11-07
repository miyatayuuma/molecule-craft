# MC-COMPARE-02｜沸点比較・沸騰観察（3分子試作）

## 試作入口

分子図鑑 → くらべる → `沸点`。パイロットは `?compareBoilingPilot=1` を付けた URL でだけ有効。通常のモル質量・原子数の比較は変更しない。

試作対象: n-ブタン −0.5 °C、エタノール 78.4 °C、水 100.0 °C。NIST Chemistry WebBook SRD69 の常圧沸点に基づく表示値。完全な物性データベースではない。

- https://webbook.nist.gov/cgi/cbook.cgi?ID=C106978&Type=TBOIL
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=6
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4

## 観察の流れ

1. 珠を台座に合わせる。ひも・非固定珠の運動は従来どおりの PBD で計算する。
2. 既発見で沸点が登録されている試料のみ、沸点より 55 °C 低い温度から約 2.25 秒で加熱する。序盤は一気に上昇し、沸点付近ではゆっくり近づく ease-out 曲線を採用。これは教育用の視覚演出であり、実物の温度上昇速度を測定したモデルではない。
3. 加熱初期に珠が浅いガラス皿の液体試料に変わる。この変形は比較 UI の視覚的な比喩であり、測定済みの融点での相転移を意味しない。沸点に至るまで気泡は出ない。
4. 沸点に達したら約 3 秒数値が止まる。液体内の気泡が浮かび、表面にさざ波と飛沫が立ち、湯気状の気体へ移行して液面が下がる。蒸発後も空の皿だけを残す。沸点の停滞は液相と気相の共存を説明する演出であり、分子自体の沸騰ではない。
5. 同じ珠にとどまる限り蒸発済みのまま。ほかの珠にフォーカスを移したら、前の珠に小さな液滴が集まり 1.7 秒ほどで再凝集する。皿は以前の珠に追従しない。切替後の再選択は可能。

台座の白い発光ラインとドットは、GLB の独立した emissive テクスチャを利用して温度の上昇とともに橙色へ変化する。金属の暗い外殻は無着色。沸騰中は暖色を維持し、気化完了時とフォーカス切替時に滑らかに冷却する。Canvas フォールバック時は台座プレビューの色調を変える。

視認性の補強: PBR 材質の emissive 色変更だけでは ACES トーンマッピングと元の白い発光に色が埋もれやすい。そのため、GLB の同じ emissive テクスチャ・UV を共有する *tonemapped=false* の加算描画層を重ね、元の白発光は加熱時に弱める。さらに小さな暖色光を台座中心に追加する。Canvas フォールバックは元画像と暖色加工した複製画像をクロスフェードして、白いラインの変化を確実に見せる。

未知の分子には名前・数値・沸点演出を表示しない。既存の発見・セーブ・データ型は変更しない。

## 技術・帰属

- Three.js 既存 r180 の WebGL シーンに統合。
- Three.quarks **v0.16.0**、MIT License、© 2019 Forrest Sun。`vendor/quarks/LICENSE` に原文を保持。`three.quarks.esm.js` を esbuild で一度だけバンドル、Three.js は `external` として import map で共用。エフェクト使用時のみ遅延読み込みする。
- WebGL 非対応・パーティクル読み込み失敗時には数値表示と既存 Canvas rope にフォールバック。
- 透明な浅皿・着色可能な液体ボディ・波打つ自由表面・メニスカスを Three.js で構築。液中の泡は 40 個以下の InstancedMesh、表面飛沫と気化の霧は低負荷の Quarks スプライト粒子。3D 流体ソルバーや物理的な気液界面計算ではない。
- 液体色は分子 DB の `phaseAppearance.liquid` を参照。記録のない物質と無色液体は淡い透明色にし、原子模型の元素カラーを流用しない。未知分子の色は非公開。

## 限定検証

`node --test tests/compare-boiling-cycle.test.mjs tests/compare-boiling-heater.test.mjs tests/compare-boiling-morph.test.mjs tests/encyclopedia-compare.test.mjs tests/compare-rope-physics.test.mjs`

ブラウザ試作では、同じ珠を繰り返し自動発火しないこと、切替中に旧珠が復元すること、未知珠の表示、Android の描画負荷を確認する。
