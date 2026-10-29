# Exploration Route Kit

`src/veil/route-kit.js` は探索フィールド専用の軽量ルート部品層です。GUIエディタや汎用Prefabではなく、ステージ固有の大量座標を減らし、同じ幾何を描画・粒子・弱い流れ・socket配置で再利用するために使います。

## 基本ルール

- 接続は前部品の exit の位置と角度を次部品の entry に渡す。
- 自動接続では平行移動と回転だけを行い、スケールしない。
- サイズ調整は `length`、`radius`、`width`、`turns`、`sweep` など部品自身の値で行う。
- 中心線は理想航路の基準であり、プレイヤーを線へ拘束しない。
- `fieldLines` は中心線から生成するが、実際の場の強さはFeature側で決める。
- 障害物・報酬・encounterはルート本体へ埋め込まず、`routeSocket()` またはFeature固有socketへ後付けする。

## v1 primitives

- `straight({ length })`
- `smoothCurve({ length, turn })`
- `flybyArc({ radius, sweep })`
- `spiralIn({ outerRadius, innerRadius, turns, direction })`
- `spiralOut({ innerRadius, outerRadius, turns, direction })`
- `createRoute({ entry, segments, width, spacing })`
- `routeSocket(route, progress, id)`

`createRoute()` は連結後の中心線と5本の `fieldLines`、entry / exit / segment境界socketを返します。

## Vortex

現行O₂渦は、汎用RouteSegmentと局所的な場を分離しています。

- `OXYGEN_VORTEX_ROUTE`：侵入 → spiral-in → 中心通過 → spiral-out → 脱出の航行幾何
- `OXYGEN_VORTEX`：中心、影響半径、接線流、内向き流、脱出補助、周回粒子、feature socket

渦の描画は `OXYGEN_VORTEX_ROUTE.fieldLines` を使い、物理は `oxygenVortexFlowAt()` が同じルートを弱いガイダンスとして参照します。ガイダンスは渦本体より十分弱く、core付近では0へフェードするため、見えないレールにはしません。

## 現行渦で守る回帰条件

- 入口の予兆流は弱い。
- 外周では渦本体の流れが明確に支配的になる。
- 流れと同方向へ接線侵入すると、中心到達が正面突破より少し有利になる。
- coreは拘束点にせず通過可能にする。
- 外向き＋接線方向の操作で脱出補助を得られる。
- 標準推進だけでも1周未満で中心到達・脱出可能にする。
- ルート線を太い道路として描かず、淡い構造線・流線・移動粒子で方向を読ませる。

## 拡張時の判断

新しいルートを作るとき、まず既存primitiveの組合せで表現できるか確認します。1ステージだけで使う特殊形状をすぐprimitive化せず、複数箇所で再利用する意味が出たときだけ追加します。JET、DEBRIS、HEAT_ZONE、ENEMY、REWARDなどはRouteSegmentへ混ぜず、Featureまたはsocket接続として実装します。
