# Molecule Graph production design

> Production source of truth: `data/molecule-graph.json`, paired 1:1 with `data/molecules.json`. The 162-entry legacy inventory was replaced by the audited 129-node graph in Molecule DB v2.

## 1. Decision summary

The production database and discovery graph now contain **129 molecules / nodes** connected by **144 edges**. The migration applied the PR #176 audit outcome: RETAIN 117, REWRITE 8, DELETE 37, and ADD 4. The graph is one connected component, has no isolated nodes, a maximum direct-neighbor count of **6**, and a longest degree-2 corridor of **4**.

The main reduction is not “remove obscure chemistry.” It is “remove repeated homolog/isomer cards when they do not open a new branch.” This keeps characteristic leaves such as `carbon-tetrachloride`, `aspirin`, `methionine`, and `dimethyl-sulfoxide`, while removing repeated C5 alkene/ketone/ester/cresol/xylene variants whose graph role is already represented nearby.

## 2. Graph model

This is a **general undirected discovery graph**, not a reaction mechanism diagram and not a single-parent tree.

- An edge means “these two molecules are understandable neighbors after a relatively small structural change.”
- `from` → `to` records the preferred conceptual progression from simpler to more derived structure. Adjacency/frontier traversal is **undirected by schema contract**; the compact graph does not store a redundant `bidirectional` flag.
- Each edge exists once in `edges[]`; each node stores incident array indexes in `connectionEdgeIndexes[]`. This avoids reciprocal edge duplicates while keeping node-local traversal cheap in the compact machine graph.
- Direct neighbors are intentionally capped at **6** so a selected molecule can show its immediate neighborhood around a phone-sized radial layout.
- Cross-links are preferred over long homolog ladders where a chemically understandable cross-link exists.
- A LEAF is allowed only when it has a strong property, use, structural distinction, or familiar context.

## 3. ROOT policy and current progression compatibility

The graph has three structural ROOTs:

| ROOT | Existing progression meaning | Graph treatment |
|---|---|---|
| `hydrogen` (H2) | H phase: player hand-crafts H2 and gains BURST | ROOT, but **not auto-discovered on fresh save** |
| `methane` (CH4) | Carbon phase: CH4 is discovered after reaching C | ROOT for the carbon trunk, without changing current unlock timing |
| `oxygen` (O2) | Oxygen phase: O2 discovery enables combustion progression | ROOT for the oxygen side, without changing current unlock timing |

`water` is intentionally **not** a ROOT. It is a high-value H/O BRIDGE. Current `docs/hco-growth.md` explicitly treats H2O as useful but optional rather than a CHO completion requirement; the production graph preserves that behavior.

`freshSaveKnownGraphNodes` is therefore empty. “ROOT” means layout/progression anchor, not “grant this recipe on a fresh save.”

## 4. Family model

Families are sized for visual branches, not taxonomic completeness. Molecules with multiple concepts use one primary `family` plus one or more `branchKeys`.

| Family | Nodes | Preferred sector | Scope |
|---|---:|---|---|
| `elemental-diatomic` | 4 | `CENTER` | H2/O2/N2/Cl2など、elemental / diatomic起点。 |
| `small-inorganic` | 6 | `CENTER` | H2O、NH3、HX、peroxide/hypochlorous acidなど小さな無機分子。 |
| `carbon-oxides` | 3 | `E` | CO/CO2/H2CO3。organic carbon trunkとO領域をつなぐ小さなC/O branch。 |
| `sulfur-compounds` | 9 | `S` | 無機硫黄、thiol/sulfide/sulfoxideをまとめたS branch。 |
| `phosphorus-compounds` | 4 | `S` | PH3、PCl3/PCl5、H3PO4のP branch。 |
| `alkane` | 7 | `N` | 飽和鎖状炭化水素。 |
| `alkene` | 5 | `NE` | C=Cを持つ鎖状炭化水素。 |
| `alkyne` | 4 | `NE` | C≡Cを持つ鎖状炭化水素。 |
| `cyclic-hydrocarbon` | 6 | `W` | 小環からcyclohexane/cyclohexeneまでの環状炭化水素。 |
| `aromatic-hydrocarbon` | 5 | `NW` | benzene骨格を持つ炭化水素branch。 |
| `halogen-compounds` | 9 | `SW` | haloalkane/haloareneとF/Cl置換系列。 |
| `alcohol-polyol` | 10 | `E` | alcohol、polyol、benzyl alcohol、cyclohexanol。 |
| `ether-cyclic-ether` | 6 | `SE` | ether、epoxide、THF、furanをつなぐO-containing ring/ether branch。 |
| `aldehyde-ketone` | 9 | `E` | aldehyde/ketoneを一つのcarbonyl familyとして扱う。 |
| `carboxylic-acid` | 17 | `E` | mono/di/hydroxy/keto/aromatic carboxylic acid。 |
| `ester-derivatives` | 5 | `SE` | ester、acid anhydride、aspirinなどcarboxylic acid derivative。 |
| `nitrogen-compounds` | 11 | `SE` | amine、amide、nitrile、N-heteroaromatic。 |
| `amino-acid` | 5 | `SE` | small amino acids。bio branchとして独立表示価値がある。 |
| `aromatic-oxygen` | 4 | `NW` | phenol、anisole、dihydroxybenzeneの芳香族O branch。 |

The family count is intentionally moderate. For example, aldehydes and ketones share `aldehyde-ketone`; amines/amides/nitriles share `nitrogen-compounds`. Cross-cutting distinctions such as “aromatic carbonyl” live in `branchKeys`, not more family categories.

## 5. HUB design

These nodes have degree ≥ 4. No node exceeds degree 6.

| Node | Degree | Direct neighbors |
|---|---:|---|
| `acetic-acid` | 6 | `acetaldehyde`, `acetamide`, `acetic-anhydride`, `ethyl-acetate`, `glycolic-acid`, `propionic-acid` |
| `benzene` | 6 | `aniline`, `chlorobenzene`, `cyclohexene`, `phenol`, `pyridine`, `toluene` |
| `n-butane` | 6 | `1-butanol`, `1-butene`, `cyclobutane`, `isobutane`, `n-pentane`, `propane` |
| `carbon-dioxide` | 5 | `carbon-monoxide`, `carbonic-acid`, `carbonyl-sulfide`, `formic-acid`, `oxygen` |
| `ethane` | 5 | `1-2-dichloroethane`, `ethanol`, `ethene`, `methane`, `propane` |
| `propane` | 5 | `2-propanol`, `cyclopropane`, `ethane`, `n-butane`, `propene` |
| `toluene` | 5 | `benzene`, `benzyl-alcohol`, `ethylbenzene`, `methylcyclohexane`, `p-xylene` |
| `water` | 5 | `carbonic-acid`, `hydrogen`, `hydrogen-peroxide`, `hydrogen-sulfide`, `oxygen` |
| `acetaldehyde` | 4 | `acetic-acid`, `ethanol`, `ethylene-oxide`, `propionaldehyde` |
| `alanine` | 4 | `glycine`, `lactic-acid`, `pyruvic-acid`, `serine` |
| `cyclohexane` | 4 | `cyclohexanol`, `cyclohexene`, `methylcyclohexane`, `n-hexane` |
| `ethene` | 4 | `ethane`, `ethylene-oxide`, `ethyne`, `vinyl-chloride` |
| `glycolic-acid` | 4 | `acetic-acid`, `glycine`, `lactic-acid`, `oxalic-acid` |
| `methane` | 4 | `chloromethane`, `ethane`, `fluoromethane`, `methanol` |
| `phenol` | 4 | `anisole`, `benzene`, `catechol`, `salicylic-acid` |
| `salicylic-acid` | 4 | `aspirin`, `benzoic-acid`, `methyl-salicylate`, `phenol` |

Three nodes deliberately sit at degree 6:

- `n-butane`: chain extension, branching, unsaturation, ring formation, alcohol oxygenation.
- `benzene`: cyclic→aromatic bridge plus substitution into hydrocarbon, O, N, and halogen directions.
- `acetic-acid`: central oxygen-chemistry hub into aldehyde/acid extension, hydroxy acid, ester, anhydride, and amide.

This is the intended “discover one molecule and several new mysteries appear” behavior. Degree is not increased further; extra xylene/cresol/ester homologs were removed partly to protect this local readability.

## 6. Important BRIDGEs

`BRIDGE` is curated rather than automatically assigned to every cross-family edge.

| Node | Family | Degree | Branch keys |
|---|---|---:|---|
| `acrylic-acid` | carboxylic-acid | 3 | oxygen-acid, unsaturation |
| `ammonia` | small-inorganic | 3 | fundamentals |
| `benzene` | aromatic-hydrocarbon | 6 | aromatic |
| `carbon-dioxide` | carbon-oxides | 5 | carbon-oxygen |
| `carbonyl-sulfide` | sulfur-compounds | 2 | sulfur |
| `cyclohexene` | cyclic-hydrocarbon | 2 | rings, unsaturation |
| `cysteine` | amino-acid | 2 | amino-acid, sulfur |
| `dimethyl-ether` | ether-cyclic-ether | 3 | oxygen-ether |
| `dimethyl-sulfide` | sulfur-compounds | 3 | sulfur |
| `ethene` | alkene | 4 | unsaturation |
| `ethylene-oxide` | ether-cyclic-ether | 3 | oxygen-ether |
| `formaldehyde` | aldehyde-ketone | 3 | oxygen-carbonyl |
| `glycolic-acid` | carboxylic-acid | 4 | oxygen-acid |
| `lactic-acid` | carboxylic-acid | 3 | oxygen-acid, bio |
| `methylcyclohexane` | cyclic-hydrocarbon | 2 | rings |
| `pyruvic-acid` | carboxylic-acid | 2 | oxygen-acid, bio |
| `salicylic-acid` | carboxylic-acid | 4 | oxygen-acid, aromatic |
| `serine` | amino-acid | 2 | amino-acid |
| `styrene` | aromatic-hydrocarbon | 2 | aromatic |
| `water` | small-inorganic | 5 | fundamentals |

Notable design choices:

- `cyclohexene` (**ADD**) fills the missing step `cyclohexane → cyclohexene → benzene`. Without it, cyclic hydrocarbon → aromatic requires a large conceptual jump.
- `ethylene-oxide` cross-links `ethene`, `acetaldehyde`, and `ethylene-glycol`: unsaturation, constitutional isomerism, and oxygenation meet at one small molecule.
- `dimethyl-ether` links the alcohol isomer (`ethanol`), ether homologs, and sulfur substitution (`dimethyl-sulfide`).
- `glycolic-acid` links ordinary carboxylic acids, dicarboxylic acids (`oxalic-acid`), hydroxy acids, and amino acids (`glycine`).
- `pyruvic-acid` (**ADD**) links `lactic-acid` and `alanine`, creating a useful carbonyl/carboxyl/bio bridge rather than a disconnected amino-acid branch.
- `salicylic-acid` opens two meaningful medicinal/aromatic leaves (`aspirin`, `methyl-salicylate`) while also linking `benzoic-acid` and `phenol`.

## 7. Edge relations

| Relation | Meaning |
|---|---|
| `chain-extension` | 主骨格へC単位を比較的小さく追加する。 |
| `bond-order` | 主骨格を保ち、単/二/三結合など結合次数を変える。 |
| `oxygenation` | 主骨格を保ちながらOを導入、またはO数/酸化度を一段変える。 |
| `ring-formation` | 鎖を閉じる、または環形成を主変化として扱う。 |
| `aromatization` | 環骨格を保ちながら芳香族化を主変化として扱う。 |
| `functional-group` | 主骨格を概ね保ち、主要官能基を隣接familyへ変える。 |
| `isomer` | 同一分子式で結合位置・分岐などを変える。 |
| `substitution` | 主骨格を保ちながら原子/置換基を入れ替える。 |
| `bridge` | 厳密な一段反応ではないが、基礎概念・元素branchを意味的かつ化学的に無理なく接続する。使用は限定する。 |

`bridge` is intentionally rare. It is reserved for fundamentals where no literal one-edit structural neighbor exists but a disconnected component would be worse and the chemical relationship remains intelligible. It must not become a generic “connect anything” escape hatch.

## 8. Preferred sector policy

`preferredSector` is a **weak layout bias**, never a fixed coordinate.

- N: carbon chain extension.
- NE: unsaturation.
- E: oxygen compounds / carbonyl / acids.
- SE: ether, ester, N compounds, amino acids.
- S: sulfur and phosphorus.
- SW: halogen compounds.
- W: cyclic hydrocarbons.
- NW: aromatics.
- CENTER: elemental / small inorganic fundamentals.

When a node becomes selected, the UI may still evenly distribute its direct neighbors around a circle. Sector bias only breaks symmetry so “oxygen is usually to the right” and “aromatic/rings are usually left-ish” remain spatially learnable across focus changes.

The machine data keeps the sector on each node and the default on each family. No exact angle per edge is required.

## 9. Depth and progression tier

`depth` is the exact shortest-path distance from any graph ROOT (`hydrogen`, `methane`, `oxygen`). It is machine-validated.

`tier` is a coarse band used only for weighting:

| Tier | Depth |
|---:|---|
| 0 | ROOT |
| 1 | 1–2 |
| 2 | 3–4 |
| 3 | 5–7 |
| 4 | 8–10 |
| 5 | 11+ |

This is **not a hard unlock system**. Existing element availability, recipe discovery, utility roles, and FIELD progression remain separate. The purpose is to prevent a random insight algorithm from repeatedly walking a deep single branch while shallow unexplored branches remain around the player.

## 10. FIELD region affinity

Each node contains `regionAffinities: [{region, weight}]`, using only:

- `Hydrogen`
- `Carbon`
- `Oxygen`
- `Deep`
- `Frontier`

Weights are soft bias values (0–1), not gates.

Examples:

- alkanes/alkenes: `Carbon` dominant.
- alcohol/carbonyl/acid: `Oxygen` dominant.
- aromatic: `Deep` dominant with secondary `Carbon`.
- N/S/P/halogen: `Frontier` + `Deep`.
- amino acids / complex oxygenated molecules: `Deep` + `Frontier`.
- H2/H2O keep explicit `Hydrogen` affinity.

The future selector should multiply or add this bias only after existing runtime eligibility is applied.

## 11. Deterministic frontier candidate contract

Given `discoveredIds`, `knownRecipeIds`, and `currentRegion`:

```text
candidateMap = empty map

for each discovered node:
  for each edge id in node.connections:
    edge = edgesById[edge id]
    neighbor = edge.from === node.id ? edge.to : edge.from
    if edge.bidirectional !== true: respect direction rules
    if neighbor is discovered: continue
    if neighbor is already a known recipe/discovery: continue
    candidateMap[neighbor] = candidate node   // id-keyed => dedupe

for each candidate:
  depth = candidate.depth
  shallowFrontierBonus = f(depth)

  unexploredBranchBonus =
    candidate.branchKeys contains a key not represented in discoveredIds

  regionAffinity =
    candidate.regionAffinities[currentRegion] ?? 0

  final weight =
    baseWeight
    × shallowFrontierBonus
    × unexploredBranchBonus
    × regionAffinityBias
```

Required data are all present in the proposal:

- direct adjacency: `connectionEdgeIndexes[]` + `edges[]` (undirected by proposal schema contract)
- duplicate removal key: node `id`
- depth: `node.depth`
- coarse progression: `node.tier`
- branch exploration signal: `node.branchKeys`
- FIELD bias: `node.regionAffinities`
- current recipe exclusion: external `knownRecipeIds` compared by the same molecule ID

The graph proposal deliberately does not duplicate current recipe ownership/save logic.

## 12. Existing DB reduction

DELETE candidates (37):

`1-4-dioxane`, `1-pentene`, `1-propanol`, `2-pentanone`, `2-pentene`, `3-pentanone`, `acetanilide`, `butyraldehyde`, `chloroethane`, `cumene`, `ethanethiol`, `ethyl-benzoate`, `ethyl-formate`, `ethyl-propionate`, `ethylamine`, `formamide`, `isobutanol`, `isobutyraldehyde`, `isobutyric-acid`, `isopentane`, `isopropyl-acetate`, `m-cresol`, `m-xylene`, `methyl-acetate`, `methyl-benzoate`, `methyl-formate`, `methyl-propionate`, `n-butyl-acetate`, `neopentane`, `o-cresol`, `o-xylene`, `p-cresol`, `propionamide`, `propylene-glycol`, `resorcinol`, `sulfur-hexafluoride`, `valeric-acid`

The detailed per-molecule rationale is in `docs/molecule-db-audit.md`. DELETE means “remove from a future graph-backed encyclopedia design,” **not** “delete from current production DB now.”

## 13. ADD candidates

| ID | Formula | Family | Roles | Why it is needed |
|---|---|---|---|---|
| `cyclohexene` | C6H10 | cyclic-hydrocarbon | BRIDGE, BRANCH | シクロヘキサン→不飽和環→ベンゼンを一段ずつ理解できる、ring/aromatic間の欠けているBRIDGE。 |
| `pyruvic-acid` | C3H4O3 | carboxylic-acid | BRIDGE, BRANCH | 乳酸とアラニンをcarbonyl/carboxylic acid側へ接続する重要BRIDGE。生化学的にも中心代謝物でLEAF水増しにならない。 |
| `furan` | C4H4O | ether-cyclic-ether | LEAF | THFの飽和環から芳香族ヘテロ環へ進むbridgeを作り、ring/ether/aromaticの枝を面として接続できる。 |
| `dimethyl-sulfoxide` | C2H6OS | sulfur-compounds | LEAF | dimethyl sulfideへ酸素を1つ導入する自然なsulfur→oxygenation終端で、強い実用価値を持つLEAF。 |

These are structural gap-fillers, not count-fillers. External chemistry spot-checks were made against PubChem for formula/basic identity before proposing them.

## 14. Description quality rules

A retained encyclopedia description should supply at least one of:

1. molecule-specific property,
2. real use,
3. familiar occurrence,
4. characteristic reactivity,
5. why the molecule matters chemically.

Pure geometry narration is insufficient unless geometry itself explains a distinctive property/reactivity and the text says so.

### Cyclobutane decision

`cyclobutane` is **REWRITE, not DELETE**.

The 4-membered ring is valuable because it sits between the very strained cyclopropane and the less strained 5/6-membered rings. Its non-planar/puckered shape is only part of the story: angle strain remains large, and the node supports a direct `n-butane → cyclobutane` ring-formation comparison. The current sentence explains only “it bends a little to reduce crowding”; it does not tell the player why that matters.

Proposed direction:

> 4員環はsp3炭素の理想結合角から大きく外れるため環ひずみが大きい。完全な平面を避けて少し折れ曲がるがひずみは残り、シクロプロパン・シクロペンタン・シクロヘキサンとの比較で環サイズと安定性の違いが見える。

All 8 REWRITE entries and replacement copy are in the DB audit.

## 15. Developer visualization

`scripts/export-molecule-graph-proposal.mjs` renders `docs/maps/molecule-graph.svg`.

The SVG is **developer-only**. It is intended to expose:

- branch balance,
- degree-heavy HUBs,
- isolated nodes,
- excessive long corridors,
- ROOT/ADD/LEAF distribution,
- broad sector placement.

It is not a prototype for production encyclopedia UI.

Run:

```bash
node scripts/export-molecule-graph-proposal.mjs
node scripts/export-molecule-graph-proposal.mjs --check
```

## 16. Validation contract

`tests/molecule-graph-proposal.test.mjs` verifies:

1. no isolated proposal node,
2. every edge endpoint exists,
3. no duplicate undirected pair,
4. no self-edge,
5. every edge is treated as one undirected pair and both endpoint `connectionEdgeIndexes[]` lists are exact,
6. every node has a declared family,
7. every node has at least one valid role,
8. every node has integer depth/tier and valid affinity/sector data,
9. all nodes are reachable from the ROOT set and stored depth equals recomputed shortest path,
10. max direct-neighbor count ≤ 6 and the degree-6 set is explicit,
11. no degree-2 corridor has more than 5 interior nodes,
12. all `DELETE` inventory IDs are absent from graph nodes,
13. every `ADD` has a reason and an audit entry,
14. `existingInventory` exactly matches production `data/molecules.json` IDs/order,
15. committed SVG equals deterministic exporter output.

This keeps proposal drift detectable without wiring any of it into production runtime.
