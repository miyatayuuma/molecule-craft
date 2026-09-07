# 視覚主体UIと在庫連動版の統合

2026-09-07。`origin/main` の `592ee45`（在庫連動の粒子減少）へローカルmainをfast-forwardし、制作中のCHO進行・酸素経路の変更を統合した。

## 開発前提

フィールドは出発時の基地原子在庫で生成する。タンクに支払い済みの原子は基地在庫に含まれず、遠征途中の採集で同じフィールドを再生成しない。減少の閾値・確率は更新元を維持。追加済みの酸素採集地点も同じ減少規則に従う。seedごとの間引きなので、個別の小さな採集地点が毎回減るとは限らない。

同じseedで在庫だけを変えたとき、経路・炭素塊の位置・信号・流れの乱数系列は維持する。`createUniverse(seed, stock, {harvestLayout})` として、基地在庫と検証用の配置指定を分離した。

`simulate-oxygen-routes.mjs` の既存表は **stock={} の間引きなし基準**。在庫が潤沢な通常プレイの採集収支を示すものではない。個別評価は `--case` に `stock` を渡せる。CHO通し検証は各出発時の実際の基地在庫を渡す。

## 今回の画面変更

- 通常画面の進行説明・自動学習文・フィールドの攻略文を抑え、発見・到達・帰還・熱の状態を記号で表示。性能説明は情報欄、学習内容は図鑑を開いて読む。操作名、元素記号、収支、保存エラーは残す。
- 4タンクの充填量を目盛り付きバーで表示。燃焼中は燃料と酸化剤を並べて表示し、同一の支払いで両方のバーを更新する。冷却剤の残量と自動冷却を熱表示にまとめる。読み上げには数値を残す。
- 補充終了・中断後は320msかけて粒子と表示をフェード。消費は指を離した時点で一度だけ確定し、キャンセルとフェード中は追加消費しない。次の補充を前の演出が隠さない。動きを減らす設定ではフェードを省く。
- 原子パレットに制作フィールドと同色の球体を追加。部品パレットには図鑑と同じ生成済み模型SVGを表示する。

## 検証

在庫減少、目印の固定、資源精算、CHO到達と保存、酸素経路、補充の途中確定・キャンセル・連続操作・表示所有権・動きを減らす設定を自動確認。本番DOMで燃料1・O₂2の同時支払いと両バー、自動冷却、支払い済み燃焼時間の保持を確認した。

Chromiumで320/390/768pxの補給画面、模型パレット、燃焼バー、図鑑→補給→制作、飛行→帰還→CHO完了を確認。保存形式・分子性能は今回のUI変更では変更していない。

実在庫を反映したゼロからの自動進行も、H₂構成（seed 1 / 60fps、11遠征、飛行280.79秒）、CO₂構成（seed 71 / 30fps、10遠征、飛行255.55秒）で完了・保存に成功。これは人間の制作時間や成功率ではない。

再現:

```sh
node --test tests/inventory-depletion.test.mjs tests/tank-charge.test.mjs tests/cho-campaign.test.mjs tests/oxygen-loadout-evaluation.test.mjs tests/oxygen-routes.test.mjs tests/supply-tanks.test.mjs tests/collection-expansion.test.mjs
node tests/veil-ui-check.mjs /path/to/jsdom/lib/api.js
node tests/mobile-ui-check.mjs /path/to/jsdom/lib/api.js
# 別ターミナルで python -m http.server 8765
node tests/oxygen-routes-browser-check.mjs /path/to/playwright/index.mjs http://127.0.0.1:8765
node scripts/simulate-cho-campaign.mjs '{"seed":1,"propellant":"hydrogen","fps":60}'
node scripts/simulate-cho-campaign.mjs '{"seed":71,"propellant":"carbon-dioxide","fps":30}'
node scripts/simulate-oxygen-routes.mjs --case '{"stock":{"H":800,"C":400,"O":400},"routeId":"oxygen-main","policy":"continuous","drive":true,"coolant":"water"}'
```

次は、初見の人が説明を開かずに出発・帰還・制作・充填を発見できるかと、燃料／酸化剤の同時消費、冷却の働きを読み取れるかを実機で観察する。実機の操作感と直感性はまだ未確認。
