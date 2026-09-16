# Molecule frontier balance

`src/molecule-frontier*.js` は `data/molecule-graph.json` と現在の発見状態から、次の recipe insight 候補を決める純粋ロジックです。FIELD の出現・run lifecycle・帰還・図鑑 UI には接続しません。

## Candidate rule

`getFrontierCandidates(graph, {discoveredIds, knownRecipeIds})` は、有効な discovered node の direct neighbor のうち、未発見かつ recipe 未取得の production graph node だけを返します。ID で重複排除し、辞書順へ正規化するため、入力順・edge 記述順・Map iteration 順に依存しません。Graph ROOT (`hydrogen`, `methane`, `oxygen`) は自動的に discovered にはしません。

candidate metadata は `id`, `depth`, `tier`, `family`, `branchKeys`, `regionAffinities`, `directDiscoveredNeighbors`, `directUndiscoveredNeighbors`, `baseWeight` を持ちます。multi-parent node は一件だけ返し、discovered neighbor は全件記録しますが親数による加点はしません。

## Weight formula

`scoreFrontierCandidates` の最終値は次です。

```text
weight = 1.0
       × shallowFactor
       × unexploredBranchFactor
       × regionAffinityFactor
```

各factorと入力値は `candidate.weighting` に残すため、テスト・balance調整から内訳を確認できます。欠損metadataはneutral factorへ倒し、eligible candidateのweightは常に有限かつ正です。

### Shallow factor

```text
1 + 0.16 / max(1, depth)
```

代表値は depth 1 = 1.16、2 = 1.08、3 ≈ 1.053、4 = 1.04、5 = 1.032 です。浅いfrontierを穏やかに優遇しますが、deep側を減点・除外しません。

### Unexplored branch factor

対象は**現在candidateに現れている branchKeys だけ**です。各visible branchについて「現在discoveredなproduction nodeのうち、そのbranchKeyを持つnode数」を数え、visible branch間の最小値〜最大値で相対進行度を正規化します。

```text
relativeUnexplored = (maxDiscovered - branchDiscovered) / (maxDiscovered - minDiscovered)
unexploredBranchFactor = 1 + 0.28 × average(relativeUnexplored for candidate branchKeys)
```

visible branchの進行数がすべて同じ、またはbranchKeysがない場合は `1.0` です。最大でも `1.28` なので、未探索方向を押しつつ既探索branchをhard gateしません。branch全体のnode総数は式に使わないため、大きいbranchが「残数が多い」という理由だけで恒常的に有利にはなりません。

### Region affinity factor

Graph affinity値 `0..1` に対し、

```text
1 + 0.25 × affinity
```

です。affinityなし・regionなし・未知regionは `1.0` のままです。現行FIELD canonical IDは `veil → Hydrogen(H)`, `carbon → Carbon(C)`, `oxygen → Oxygen(O)`, `frontier → Frontier(F)`。Graphが持つ `Deep(D)` は `deep` 入力も受けます。表示名 (`H Veil`, `Carbon Drift`, `Oxygen Surge`, `Inner Horizon`) と H/C/O/D/F も同じcanonical affinityへ正規化します。

## Selection

`selectFrontierCandidate(scored, {rng})` は候補をID順に正規化してweighted selectionします。複数候補ではRNG注入が必須で、内部から `Math.random()` は呼びません。一候補ならRNGなしでも必ずその候補を返します。テスト用に `createSeededFrontierRng(seed)` を提供します。frontierが空、または有効weightがない場合は `null` で、全DBからのfallback抽選はありません。

## Example

同じdepthの候補 `worked` と `fresh` があり、visible branchのdiscovered数が `worked=2`, `fresh=0` なら、branch factorは概ね `worked=1.00`, `fresh=1.28` です。Carbon affinity `1.0` のcandidateを `carbon` regionでscoreするとさらにregion factor `1.25` が掛かります。これらは乗算されますが、shallow・branch・regionの各factorは小さく上限が固定され、一要素だけでは選択を固定しません。

## Deterministic production simulation

`tests/molecule-frontier.test.mjs` は unit cases に加えproduction 135-node graphをsimulationします。Graph-only simulationなので、engineとは別にROOT 3件を初期discoveredとして明示し、seed `7, 19, 43, 101, 313` ごとに frontier選択→discovered追加を繰り返します。

- 25 discoveries: 4 branch以上、4 family以上、最大branch占有率80%未満、平均depth 3.5未満
- 50 discoveries: branch/family diversityが25時点から縮まない
- 100 discoveries: depth 4以上（graph maxが4未満ならそのmax）へ到達
- completion: 5 seedすべてでROOTからreachableな135 nodeを完走し、production graphの最大depthへ到達
- region bias: 同一frontier・同一seedの4000 deterministic drawsで、Carbon/Oxygen regionが対応affinity candidateの選択頻度を増やす

これらは確率的pass/failではなく固定seedのregressionです。

## Known limitations

unexplored評価はbranchKey単位の相対進行数であり、「直前HUB」を推定する局所topology modelではありません。現状の135-node graphでは説明可能性とbalance調整容易性を優先しています。またdifficulty、utility unlock、FIELD距離、元素所持量、1 expedition / 1 insight、carried/commit/lossはscoreへ入れていません。それらはFIELD integration側の責務です。
