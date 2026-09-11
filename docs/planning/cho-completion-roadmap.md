# CHO completion — remaining playtest gate

Status: **D — active future work.**

CHOの機械的な完了条件、保存、経路、LOADOUT、推進、帰還はproductionへ実装済みです。現在のruntime契約は `../hco-growth.md` を参照してください。この文書には、まだ実施していない**人間の初見プレイ検証だけ**を残します。

## Unvalidated product target

目標は、新規保存から攻略説明なしで開始し、初見プレイヤーが概ね30〜60分でCHO最深部へ到達し、同じ遠征で通常帰還して完了できることです。

自動simulationの飛行時間や既知経路を使ったbrowser checkは、この目標の検証には数えません。

## First-play protocol

目安として初見プレイヤー3人以上で確認します。

記録するもの：

- 端末と入力方式
- 初回CHO完了までの実時間
- 何をすべきか分からず停止した場面
- H₂ / CH₄ / O₂ / coolant / LOADOUTの意味を自力で理解できたか
- BURST、DRIVE、帰還lock、LOADOUT出発操作の誤操作
- 材料不足による反復採集回数
- 捕獲後に原因を理解し再挑戦できたか
- 経路選択や装備差が「数値表」ではなく挙動として読めたか

口頭で攻略法を教えたプレイは初見検証として扱いません。

## Decision order after playtest

1. 進行停止・操作不能・誤誘導を修正する。
2. 次に、説明不足なのか、操作feedback不足なのか、資源量／難度の問題なのかを切り分ける。
3. その後で30〜60分の長さと不要な周回量を調整する。
4. 単に時間を延ばすための待ち時間、材料grind、必須分子を追加しない。

## Completion gate

次を確認するまで、CHO版を「初見体験まで完成」とは扱いません。

- 複数の初見プレイヤーが重大な進行停止なしで完了できる。
- 主要操作がmobileを含む実機で成立する。
- 目標時間が大きく外れていない、または外れる理由が把握されている。
- 装備・routeの選択差が少なくとも一部で体感できる。
- 修正が必要な場合、その原因がproduction contractかpresentation/tuningか分類できている。

## Scope guard

このplaytestが終わる前に、検証目的だけで新元素、combat、boss、skill tree、単一分子keyを追加しません。新しい縦切りは `molecule-craft-astra-direction-brief.md` のpost-CHO計画として別管理します。
