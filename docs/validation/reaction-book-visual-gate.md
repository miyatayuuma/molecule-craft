# MC-RB-01 反応図鑑の視覚品質ゲート

対象: 軽量グループアニメ4例・個別反応サムネ5例の試作。化学と反応状態の正本は既存authorityとprogress。T7ゲームルールは変更しない。

## 自動必須ゲート

| ID | 合格条件 | 検証 |
|---|---|---|
| G01 | 54経路・14分類・fixture一致。多分類所属の実証数を水増ししない | 既存encyclopediaテスト＋新ゲート |
| G02 | 4分類（加水分解・付加・環化・重合）で異なるSVGモーション。2〜3秒、カード別WebGLなし | 新ゲート＋DOM |
| G03 | 5経路のID・構造特徴・反応式は化学正本と整合。新しい状態保存を持たない | 新ゲート |
| G04 | 未発見名・反応式・サムネ・IDが一覧DOMに出ない。未発見件数だけ表示 | Chromium DOM |
| G05 | hintedは未実証表示とLAB導線を保持。verifiedは条件と個別説明に進め、戻れる | Chromium |
| G06 | 360px/1280pxで横方向オーバーフローなし。タップ対象44px以上 | Chromium |
| G07 | 動き軽減設定では静止。画面外では可能な範囲で停止。GIF常時再生なし | CSS/Chromium |
| G08 | 発見・ひらめき・実証の保存互換、LAB導線を保持 | 限定回帰 |
| G09 | hygiene、precache整合 | repository scripts |

実行: node --test tests/reaction-book-visual-gate.test.mjs tests/reaction-encyclopedia.test.mjs tests/reaction-progress.test.mjs
CI: .github/workflows/reaction-book-visual-gate.yml

## 視覚受入（自動PASSと別）

- V01: 同じ図鑑UIで4種の形と動きが判別できる。色だけで区別させない。
- V02: 5種の前後図が相互に区別でき、化学的誤表現がない。機構や中間体を断定しない。
- V03: スマホ360px・PCの実画面を提示し、文字・模型・操作が読み取れる。
- V04: 逆再生で反応の可逆性を暗示しない。周期終端から初期状態へはフェード等で戻す。
- V05: 体感的な重さがない。環境依存のFPS値を自動閾値で断定しない。

## 試作と禁止範囲

- グループ: 加水分解、付加、環化、重合。
- 個別: 無水酢酸の加水分解、エチレンへの塩素付加、シクロブタンの環化、PE、PET。
- まず品質ゲートを先行コミットし、同一Draft PRに後続Work実装を積む。
- 受入まで14分類/54反応への量産、mainマージ、本番デプロイは行わない。
- 既知の無関係テスト失敗は差分由来のものと区別する。
