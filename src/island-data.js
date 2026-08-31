// Toy-scale parameters, NOT measured values, recipes, or real-world quantities.
// Sodium chloride is a collected ionic crystal, never a covalent craft recipe.
const defaults = {
  phase: 'gas', polarity: 0, waterSolubility: 0, hydration: 0,
  flammability: 0, acidity: 0, basicity: 0, conductivityEffect: 0,
  toxicity: 0, volatility: .5, oxygenRole: 0, carbonFeed: 0,
  nutrientRole: 0, buoyancy: 0, crystal: 0, solventPower: 0,
};
const sample = (id, name, formula, color, properties, extra = {}) => Object.freeze({
  id, name, formula, color, source: 'craft',
  properties: Object.freeze({...defaults, ...properties}), ...extra,
});
export const ISLAND_SAMPLES = Object.freeze([
  sample('water', '水', 'H₂O', '#69d7ef', {phase:'liquid', polarity:1, waterSolubility:1, hydration:1, volatility:.03}),
  sample('oxygen', '酸素', 'O₂', '#ff8f88', {oxygenRole:1, waterSolubility:.15}),
  sample('carbon-dioxide', '二酸化炭素', 'CO₂', '#b7bbd0', {oxygenRole:-1, waterSolubility:.6, acidity:.15, carbonFeed:1}),
  sample('hydrogen', '水素', 'H₂', '#eef9ff', {flammability:1.05, buoyancy:1, volatility:1}),
  sample('methane', 'メタン', 'CH₄', '#f5c789', {flammability:1, volatility:.65}),
  sample('ammonia', 'アンモニア', 'NH₃', '#a3b9ff', {polarity:.9, waterSolubility:1, basicity:1, toxicity:.6, nutrientRole:1, conductivityEffect:.18, volatility:.8}),
  sample('ethanol', 'エタノール', 'C₂H₅OH', '#ffc2a2', {phase:'liquid', polarity:.6, waterSolubility:1, flammability:.7, solventPower:.6, toxicity:.3, volatility:.3}),
  sample('acetone', 'アセトン', 'C₃H₆O', '#e5a8e6', {phase:'liquid', polarity:.65, waterSolubility:1, flammability:.85, solventPower:1, toxicity:.5, volatility:.7}),
  sample('acetic-acid', '酢酸', 'CH₃COOH', '#ffb7cb', {phase:'liquid', polarity:.9, waterSolubility:1, acidity:1, toxicity:.3, conductivityEffect:.16, volatility:.12}),
  sample('salt', '塩の結晶', 'NaCl', '#f5eee4', {phase:'solid', waterSolubility:1, conductivityEffect:1, crystal:1, volatility:0}, {source:'mineral'}),
]);
export const SAMPLE_BY_ID = new Map(ISLAND_SAMPLES.map(item => [item.id, item]));

// Positions are shared by the simulation, target picking and the diorama.
export const ISLAND_TARGETS = Object.freeze([
  {id:'pond', name:'くぼんだ池', x:-2.2, z:1.1, radius:1.3, tags:['aqueous','habitat','pond'], note:'底が見える。ふちには小さな足あと。'},
  {id:'garden', name:'しおれた庭', x:-2.5, z:-1.3, radius:1.05, tags:['soil','habitat','garden'], note:'葉が下を向いている。何かを待っているみたい。'},
  {id:'cell', name:'ふたつの金属の装置', x:.7, z:.55, radius:.85, tags:['aqueous','cell','vessel'], note:'色の違う金属板。線は洞窟のランプへ続いている。'},
  {id:'burner', name:'実験コンロ', x:3.15, z:1.45, radius:.85, tags:['burner','vessel'], note:'赤いスイッチと、小さな風車がついている。'},
  {id:'cave', name:'暗い洞窟', x:.55, z:-2.4, radius:1, tags:['cave','habitat'], note:'奥にきらり。入り口のランプは消えている。'},
  {id:'resin', name:'よごれたレンズ', x:2.55, z:-1.1, radius:.7, tags:['resin'], note:'ほこりの下に、べたべたしたよごれ。'},
  {id:'crystal', name:'ふしぎな結晶の皿', x:-.65, z:-.5, radius:.62, tags:['aqueous','indicator','vessel'], note:'紫色の結晶。小さな皿にのっている。'},
  {id:'flask', name:'しぼんだ風船', x:3.6, z:-.15, radius:.65, tags:['balloon','vessel'], note:'フラスコにつながった風船がしぼんでいる。'},
  {id:'soil', name:'砂地', x:-.15, z:2.4, radius:.68, tags:['soil'], note:'さらさらの砂。ちいさな溝が池へ続いている。'},
]);
export const TARGET_BY_ID = new Map(ISLAND_TARGETS.map(item => [item.id, item]));
export const SALT_ROCK = Object.freeze({id:'salt-rock', name:'白い粒の岩', x:-4.05, z:-.15, radius:.6});

const discovery = (id, name, note, glyph, hidden = false) => Object.freeze({id, name, note, glyph, hidden});
export const ISLAND_DISCOVERIES = Object.freeze([
  discovery('water-spreads', '水のゆくえ', '水がたまり、土へしみこんだ。', '◉'),
  discovery('garden-wakes', '葉っぱが起きた', '湿った土から、葉が立ち上がった。', '❧'),
  discovery('salt-dissolves', '消えた白い粒', '結晶が水にほどけた。見えなくなっても、なくなっていない。', '⁙'),
  discovery('conductivity', 'つながった光', '塩水がふたつの金属をつなぎ、ランプがついた。電気のもとは金属の反応。', 'ϟ'),
  discovery('weak-electrolyte', 'もうひとつの電解液', '水に溶けた酸やアルカリでも、装置に弱い光がついた。', 'ϟ'),
  discovery('combustion', 'ちいさな炎', '燃料と酸素があると、火花から炎が続いた。', '♨'),
  discovery('oxygen-boost', '炎が背のび', '酸素を加えると、炎が大きくなった。酸素だけでは燃料にならない。', '✧'),
  discovery('extinguish', '炎がおやすみ', '冷やしたり、酸素を遠ざけたりすると、炎がおさまった。', '◌'),
  discovery('solvent', 'レンズの向こう', '水で残ったべたべたが、別の液体で取れた。', '◇'),
  discovery('cave-light', '奥にも世界があった', 'ランプが洞窟を照らし、閉じていた道がひらいた。', '✦'),
  discovery('carbon-growth', '水と空気のごちそう', '水と光がある葉に、二酸化炭素を届けると大きくなった。', '❧'),
  discovery('too-much', '多ければいい？', '濃すぎる水や空気を、生き物は避けた。薄めれば帰ってこられる。', '≈'),
  discovery('recovery', 'おかえり', '水を入れ替え、空気が戻ると、生き物も戻った。', '↺'),
  discovery('rainbow', '島のちいさな滝', 'あふれた水が滝になった。水しぶきに虹がかかった。', '⌒', true),
  discovery('pinwheel', '風車、大はしゃぎ', '大きな炎の熱で、風車が勢いよく回った。', '✳', true),
  discovery('floating', 'ふわり、ひとつ上へ', '軽い気体が風船を持ち上げた。', '◍', true),
  discovery('neutralize', 'むらさきに戻った', '酸とアルカリが打ち消し合い、結晶の色が中間へ戻った。', '◈', true),
  discovery('salt-flame', '炎の着がえ', '塩の中のナトリウムが、炎を黄色く染めた。', '✹', true),
  discovery('bloom', 'ひらいた花', '水・光・空気と、少しの栄養。庭に花がひらいた。', '✿', true),
  discovery('crystal-garden', '白い結晶の庭', '装置を温めると水が減り、溶けていた塩がまた姿を見せた。', '⬡', true),
  discovery('night-parade', 'ほたる色の行進', '明るくなった洞窟から、水辺へ光の列が続いた。', '⋆', true),
]);
export const DISCOVERY_BY_ID = new Map(ISLAND_DISCOVERIES.map(item => [item.id, item]));
export const ISLAND_SPECIES = Object.freeze([
  {id:'puddle', name:'ミズポン', glyph:'◉', color:'#72cfdf', note:'水辺でぴょん。水がしょっぱすぎると、ふちへ避難する。'},
  {id:'leaf', name:'コケモチ', glyph:'❧', color:'#a8c968', note:'葉っぱの背中をゆらし、元気な庭でのんびり過ごす。'},
  {id:'glow', name:'ホタル貝', glyph:'◌', color:'#c4a6ec', note:'洞窟にひそむ、光る貝。澄んだ水辺へ散歩に出る。'},
]);
