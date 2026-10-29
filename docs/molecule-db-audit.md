# Molecule DB audit for graph proposal

> Based on production `data/molecules.json` / `data/encyclopedia.json` at `main` `0fc76f0a05bf3ae137f3a604a5f8a5ecd658ad1f`. Production DB is unchanged.

## Summary

- RETAIN **117** / REWRITE **8** / DELETE **37** = existing **162**
- ADD **4** → proposal **129 nodes**

DELETE means “future graph proposalから除外”であり、今回production DBから削除する意味ではない。

## All existing molecules

| # | id | decision | family | roles | reason |
|---:|---|---|---|---|---|
| 1 | `hydrogen` | **RETAIN** | `elemental-diatomic` | ROOT | 現行progressionと太い幹の起点。 |
| 2 | `oxygen` | **RETAIN** | `elemental-diatomic` | ROOT | 現行progressionと太い幹の起点。 |
| 3 | `nitrogen` | **RETAIN** | `elemental-diatomic` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 4 | `water` | **RETAIN** | `small-inorganic` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 5 | `carbon-dioxide` | **RETAIN** | `carbon-oxides` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 6 | `carbon-monoxide` | **RETAIN** | `carbon-oxides` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 7 | `ammonia` | **RETAIN** | `small-inorganic` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 8 | `hydrogen-sulfide` | **RETAIN** | `sulfur-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 9 | `hydrogen-chloride` | **RETAIN** | `small-inorganic` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 10 | `hydrogen-fluoride` | **RETAIN** | `small-inorganic` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 11 | `chlorine` | **RETAIN** | `elemental-diatomic` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 12 | `sulfur-dioxide` | **RETAIN** | `sulfur-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 13 | `sulfur-trioxide` | **RETAIN** | `sulfur-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 14 | `phosphine` | **RETAIN** | `phosphorus-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 15 | `phosphorus-trichloride` | **RETAIN** | `phosphorus-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 16 | `phosphorus-pentachloride` | **RETAIN** | `phosphorus-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 17 | `sulfur-hexafluoride` | **DELETE** | `sulfur-compounds` | — | 高配位孤立LEAFになり、小さな構造変化で既存S枝へ接続しにくい。 |
| 18 | `carbon-disulfide` | **RETAIN** | `sulfur-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 19 | `carbonyl-sulfide` | **RETAIN** | `sulfur-compounds` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 20 | `phosphoric-acid` | **RETAIN** | `phosphorus-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 21 | `sulfuric-acid` | **RETAIN** | `sulfur-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 22 | `hydrogen-peroxide` | **RETAIN** | `small-inorganic` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 23 | `hypochlorous-acid` | **RETAIN** | `small-inorganic` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 24 | `carbonic-acid` | **RETAIN** | `carbon-oxides` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 25 | `methane` | **RETAIN** | `alkane` | ROOT, HUB | 現行progressionと太い幹の起点。 |
| 26 | `ethane` | **RETAIN** | `alkane` | HUB | 複数branchを開くHUBとして価値。 |
| 27 | `propane` | **RETAIN** | `alkane` | HUB | 複数branchを開くHUBとして価値。 |
| 28 | `n-butane` | **RETAIN** | `alkane` | HUB | 複数branchを開くHUBとして価値。 |
| 29 | `isobutane` | **RETAIN** | `alkane` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 30 | `n-pentane` | **RETAIN** | `alkane` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 31 | `isopentane` | **DELETE** | `alkane` | — | C5分岐異性体はbutane/isobutaneで学習点が重複。 |
| 32 | `neopentane` | **DELETE** | `alkane` | — | C5分岐異性体はbutane/isobutaneで学習点が重複。 |
| 33 | `n-hexane` | **RETAIN** | `alkane` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 34 | `ethene` | **RETAIN** | `alkene` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 35 | `propene` | **RETAIN** | `alkene` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 36 | `1-butene` | **RETAIN** | `alkene` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 37 | `2-butene` | **RETAIN** | `alkene` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 38 | `isobutene` | **RETAIN** | `alkene` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 39 | `1-pentene` | **DELETE** | `alkene` | — | C5 alkeneはC2–C4系列と位置異性の重複。 |
| 40 | `2-pentene` | **DELETE** | `alkene` | — | C5 alkeneはC2–C4系列と位置異性の重複。 |
| 41 | `ethyne` | **RETAIN** | `alkyne` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 42 | `propyne` | **REWRITE** | `alkyne` | BRANCH | 末端アルキンの三重結合・末端Hを説明すべき。 |
| 43 | `1-butyne` | **REWRITE** | `alkyne` | BRANCH | 2-butyneとのterminal/internal比較を明示すべき。 |
| 44 | `2-butyne` | **REWRITE** | `alkyne` | BRANCH | 1-butyneとの位置異性・末端H不在を明示すべき。 |
| 45 | `cyclopropane` | **RETAIN** | `cyclic-hydrocarbon` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 46 | `cyclobutane` | **REWRITE** | `cyclic-hydrocarbon` | LEAF | 環ひずみ・非平面性・環サイズ比較が価値。現文は形状説明だけ。 |
| 47 | `cyclopentane` | **RETAIN** | `cyclic-hydrocarbon` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 48 | `cyclohexane` | **RETAIN** | `cyclic-hydrocarbon` | HUB | 複数branchを開くHUBとして価値。 |
| 49 | `methylcyclohexane` | **RETAIN** | `cyclic-hydrocarbon` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 50 | `benzene` | **RETAIN** | `aromatic-hydrocarbon` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 51 | `toluene` | **RETAIN** | `aromatic-hydrocarbon` | HUB | 複数branchを開くHUBとして価値。 |
| 52 | `ethylbenzene` | **RETAIN** | `aromatic-hydrocarbon` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 53 | `o-xylene` | **DELETE** | `aromatic-hydrocarbon` | — | xylene 3異性体はHUB過密化。p-xyleneだけPET枝へ接続。 |
| 54 | `m-xylene` | **DELETE** | `aromatic-hydrocarbon` | — | xylene 3異性体はHUB過密化。p-xyleneだけPET枝へ接続。 |
| 55 | `p-xylene` | **RETAIN** | `aromatic-hydrocarbon` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 56 | `styrene` | **RETAIN** | `aromatic-hydrocarbon` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 57 | `chloromethane` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 58 | `dichloromethane` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 59 | `chloroform` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 60 | `carbon-tetrachloride` | **RETAIN** | `halogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 61 | `fluoromethane` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 62 | `difluoromethane` | **RETAIN** | `halogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 63 | `chloroethane` | **DELETE** | `halogen-compounds` | — | haloethane例は1,2-dichloroethane/vinyl chlorideで十分。 |
| 64 | `1-2-dichloroethane` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 65 | `vinyl-chloride` | **RETAIN** | `halogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 66 | `chlorobenzene` | **RETAIN** | `halogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 67 | `methanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 68 | `ethanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 69 | `1-propanol` | **DELETE** | `alcohol-polyol` | — | alcohol homologの細枝化。2-propanol側がketoneへ接続。 |
| 70 | `2-propanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 71 | `1-butanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 72 | `2-butanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 73 | `isobutanol` | **DELETE** | `alcohol-polyol` | — | butanol異性体過密。1-/2-/tert-butanolで十分。 |
| 74 | `tert-butanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 75 | `ethylene-glycol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 76 | `propylene-glycol` | **DELETE** | `alcohol-polyol` | — | polyol学習点はethylene glycol→glycerolで十分。 |
| 77 | `glycerol` | **RETAIN** | `alcohol-polyol` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 78 | `cyclohexanol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 79 | `dimethyl-ether` | **RETAIN** | `ether-cyclic-ether` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 80 | `methyl-ethyl-ether` | **REWRITE** | `ether-cyclic-ether` | BRANCH | ether同族体の中間node価値を説明すべき。 |
| 81 | `diethyl-ether` | **RETAIN** | `ether-cyclic-ether` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 82 | `tetrahydrofuran` | **RETAIN** | `ether-cyclic-ether` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 83 | `1-4-dioxane` | **DELETE** | `ether-cyclic-ether` | — | cyclic ether枝でTHF/epoxide/furanより追加接続価値が弱い。 |
| 84 | `ethylene-oxide` | **RETAIN** | `ether-cyclic-ether` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 85 | `methanethiol` | **RETAIN** | `sulfur-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 86 | `ethanethiol` | **DELETE** | `sulfur-compounds` | — | thiol homologはmethanethiolで代表可能。 |
| 87 | `dimethyl-sulfide` | **RETAIN** | `sulfur-compounds` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 88 | `formaldehyde` | **RETAIN** | `aldehyde-ketone` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 89 | `acetaldehyde` | **RETAIN** | `aldehyde-ketone` | HUB | 複数branchを開くHUBとして価値。 |
| 90 | `propionaldehyde` | **REWRITE** | `aldehyde-ketone` | BRANCH | acetoneとのC3H6O異性体BRIDGEを説明すべき。 |
| 91 | `butyraldehyde` | **DELETE** | `aldehyde-ketone` | — | aldehyde homologの細枝化。C3でketone/isomer橋を作る方が強い。 |
| 92 | `isobutyraldehyde` | **DELETE** | `aldehyde-ketone` | — | aldehyde分岐異性の水増し。 |
| 93 | `benzaldehyde` | **RETAIN** | `aldehyde-ketone` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 94 | `acetone` | **RETAIN** | `aldehyde-ketone` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 95 | `2-butanone` | **RETAIN** | `aldehyde-ketone` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 96 | `2-pentanone` | **DELETE** | `aldehyde-ketone` | — | ketone homologの細枝化。 |
| 97 | `3-pentanone` | **DELETE** | `aldehyde-ketone` | — | ketone位置異性の水増し。 |
| 98 | `cyclohexanone` | **RETAIN** | `aldehyde-ketone` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 99 | `formic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 100 | `acetic-acid` | **RETAIN** | `carboxylic-acid` | HUB | 複数branchを開くHUBとして価値。 |
| 101 | `propionic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 102 | `butyric-acid` | **RETAIN** | `carboxylic-acid` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 103 | `isobutyric-acid` | **DELETE** | `carboxylic-acid` | — | acid分岐異性の水増し。 |
| 104 | `valeric-acid` | **DELETE** | `carboxylic-acid` | — | acid homologの細枝化。 |
| 105 | `oxalic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 106 | `lactic-acid` | **RETAIN** | `carboxylic-acid` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 107 | `benzoic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 108 | `methyl-formate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。代表esterへ圧縮。 |
| 109 | `ethyl-formate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。代表esterへ圧縮。 |
| 110 | `methyl-acetate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。代表esterへ圧縮。 |
| 111 | `ethyl-acetate` | **RETAIN** | `ester-derivatives` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 112 | `methyl-propionate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。代表esterへ圧縮。 |
| 113 | `ethyl-propionate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。代表esterへ圧縮。 |
| 114 | `acrylic-acid` | **RETAIN** | `carboxylic-acid` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 115 | `acetic-anhydride` | **RETAIN** | `ester-derivatives` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 116 | `methylamine` | **RETAIN** | `nitrogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 117 | `ethylamine` | **DELETE** | `nitrogen-compounds` | — | amine homologはmethyl→di→trimethylの置換系列を優先。 |
| 118 | `dimethylamine` | **RETAIN** | `nitrogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 119 | `trimethylamine` | **RETAIN** | `nitrogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 120 | `aniline` | **RETAIN** | `nitrogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 121 | `formamide` | **DELETE** | `nitrogen-compounds` | — | amide branchはacetamide→ureaの方がacid trunkに接続しやすい。 |
| 122 | `acetamide` | **REWRITE** | `nitrogen-compounds` | BRANCH | acid→amide→ureaの官能基比較を説明すべき。 |
| 123 | `propionamide` | **DELETE** | `nitrogen-compounds` | — | amide homologの細枝化。 |
| 124 | `urea` | **RETAIN** | `nitrogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 125 | `hydrogen-cyanide` | **RETAIN** | `nitrogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 126 | `acetonitrile` | **RETAIN** | `nitrogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 127 | `acrylonitrile` | **RETAIN** | `nitrogen-compounds` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 128 | `pyridine` | **REWRITE** | `nitrogen-compounds` | LEAF | benzene CH→N、芳香族性と塩基性を説明すべき。 |
| 129 | `acrolein` | **RETAIN** | `aldehyde-ketone` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 130 | `glycine` | **RETAIN** | `amino-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 131 | `alanine` | **RETAIN** | `amino-acid` | HUB | 複数branchを開くHUBとして価値。 |
| 132 | `ethylenediamine` | **RETAIN** | `nitrogen-compounds` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 133 | `phenol` | **RETAIN** | `aromatic-oxygen` | HUB | 複数branchを開くHUBとして価値。 |
| 134 | `anisole` | **RETAIN** | `aromatic-oxygen` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 135 | `acetophenone` | **RETAIN** | `aldehyde-ketone` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 136 | `catechol` | **RETAIN** | `aromatic-oxygen` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 137 | `resorcinol` | **DELETE** | `aromatic-oxygen` | — | dihydroxybenzene 3異性体は過密。catechol/hydroquinoneで対比可能。 |
| 138 | `hydroquinone` | **RETAIN** | `aromatic-oxygen` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 139 | `salicylic-acid` | **RETAIN** | `carboxylic-acid` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 140 | `acetanilide` | **DELETE** | `nitrogen-compounds` | — | aniline末端を増やすよりaspirin branchの方が統合価値が高い。 |
| 141 | `terephthalic-acid` | **RETAIN** | `carboxylic-acid` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 142 | `aspirin` | **RETAIN** | `ester-derivatives` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 143 | `malonic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 144 | `succinic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 145 | `adipic-acid` | **RETAIN** | `carboxylic-acid` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 146 | `malic-acid` | **RETAIN** | `carboxylic-acid` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 147 | `citric-acid` | **RETAIN** | `carboxylic-acid` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 148 | `glycolic-acid` | **RETAIN** | `carboxylic-acid` | HUB, BRIDGE | 複数branchを開くHUBとして価値。 |
| 149 | `o-cresol` | **DELETE** | `aromatic-oxygen` | — | cresol 3異性体は新branchを開かず過密。 |
| 150 | `m-cresol` | **DELETE** | `aromatic-oxygen` | — | cresol 3異性体は新branchを開かず過密。 |
| 151 | `p-cresol` | **DELETE** | `aromatic-oxygen` | — | cresol 3異性体は新branchを開かず過密。 |
| 152 | `methyl-salicylate` | **RETAIN** | `ester-derivatives` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 153 | `methyl-benzoate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。aromatic esterはmethyl salicylateを残す。 |
| 154 | `ethyl-benzoate` | **DELETE** | `ester-derivatives` | — | ester catalog過密。aromatic esterはmethyl salicylateを残す。 |
| 155 | `n-butyl-acetate` | **DELETE** | `ester-derivatives` | — | ester homolog過密。isoamyl acetateを特徴的LEAFとして残す。 |
| 156 | `isoamyl-acetate` | **RETAIN** | `ester-derivatives` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |
| 157 | `isopropyl-acetate` | **DELETE** | `ester-derivatives` | — | ester homolog過密。isoamyl acetateを特徴的LEAFとして残す。 |
| 158 | `cumene` | **DELETE** | `aromatic-hydrocarbon` | — | 有名反応が骨格切断を伴い、小さな構造変化edgeに不向き。 |
| 159 | `benzyl-alcohol` | **RETAIN** | `alcohol-polyol` | BRANCH | 系列を伸ばし隣接比較を成立させるBRANCH。 |
| 160 | `serine` | **RETAIN** | `amino-acid` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 161 | `cysteine` | **RETAIN** | `amino-acid` | BRIDGE, BRANCH | family間を小さな構造変化でつなぐBRIDGE。 |
| 162 | `methionine` | **RETAIN** | `amino-acid` | LEAF | 固有の性質・用途・構造が到達価値になるLEAF。 |

## REWRITE copy proposals

| id | replacement direction |
|---|---|
| `cyclobutane` | 4員環はsp3炭素の理想結合角から大きく外れるため環ひずみが大きい。完全な平面を避けて少し折れ曲がるがひずみは残り、シクロプロパン・シクロペンタン・シクロヘキサンとの比較で環サイズと安定性の違いが見える。 |
| `propyne` | 端に三重結合を持つ小さなアルキン。三重結合部分はほぼ直線形で、末端水素を手がかりにC–C結合形成へ展開できる。propane/propeneとの結合次数比較にも向く。 |
| `1-butyne` | 鎖の端に三重結合を持つC4アルキン。2-butyneと比べ、三重結合が端か内部かで反応点が変わる。 |
| `2-butyne` | 鎖中央に三重結合を持つ対称なC4アルキン。末端水素を持たず、1-butyneとの位置異性比較に向く。 |
| `propionaldehyde` | propanalとも呼ばれるC3 aldehyde。酸化でpropionic acidへつながり、同式のacetoneとのaldehyde/ketone比較BRIDGEになる。 |
| `acetamide` | acetic acidのOHがNH2へ置換されたamide。水素結合とacid→amideの官能基変換を比較できる。 |
| `pyridine` | benzeneのCHを1つNへ置換した6員芳香族heterocycle。芳香族性を保ちつつNの孤立電子対が塩基性・配位性を与える。 |
| `methyl-ethyl-ether` | Oを挟んでmethyl/ethyl基を持つ非対称ether。dimethyl ether→diethyl etherを1 carbon stepでつなぐ。 |

## ADD candidates

| id | formula | role | reason |
|---|---|---|---|
| `cyclohexene` | C6H10 | BRIDGE, BRANCH | cyclohexane→unsaturated ring→benzeneの欠けたring/aromatic BRIDGE。 |
| `pyruvic-acid` | C3H4O3 | BRIDGE, BRANCH | lactic acid/alanineをcarbonyl-carboxylic branchへ結ぶbio BRIDGE。 |
| `furan` | C4H4O | LEAF | THFからaromatic heterocycleへ進みring/ether/aromaticを接続。 |
| `dimethyl-sulfoxide` | C2H6OS | LEAF | dimethyl sulfideのoxygenation終端で、実用溶媒として強いLEAF価値。 |

## Cluster rationale

- **Homolog compression:** C5 alkene/ketone、過剰なalcohol/acid homologは同じ学習点を反復して細枝化するため削減。
- **Positional-isomer compression:** xylene/cresol/dihydroxybenzeneは全異性体を残さず、他branchへ接続する代表を残す。
- **Ester compression:** `ethyl-acetate`、`isoamyl-acetate`、`methyl-salicylate`を役割の異なる代表として残す。
- **Poor graph neighbor:** `cumene` / `sulfur-hexafluoride`は情報価値自体ではなく、小さな構造変化edgeとしての統合性が弱い。

### Cyclobutane decision

`cyclobutane`は **REWRITE**。削除しない。小さな4員環はring strainが大きく、puckeringだけでなくcyclopropane/cyclopentane/cyclohexaneとの環サイズ・安定性比較に教育価値がある。`n-butane → cyclobutane` のring-formation edgeも自然。問題はnodeではなく現説明が形状記述だけに留まること。
