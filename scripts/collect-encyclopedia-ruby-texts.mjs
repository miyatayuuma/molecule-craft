// Inventory of visible encyclopedia content for the reviewed full-text ruby map.
// Run via generate-encyclopedia-extra-furigana.py; no generated runtime code.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {reactionDetailInfo,reactionGroups} from '../src/reaction-encyclopedia.js';

const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const found=new Set();
const add=value=>{if(typeof value==='string'&&/[一-龯々]/u.test(value))found.add(value);};
const walk=value=>{
  if(typeof value==='string'){add(value);return;}
  if(Array.isArray(value)){value.forEach(walk);return;}
  if(value&&typeof value==='object')Object.values(value).forEach(walk);
};

const encyclopedia=read('data/encyclopedia.json');
const functionalGroups=read('data/functional-groups.json');
const polymers=read('data/polymers.json');
const polymerContent=read('data/polymer-encyclopedia.json');
const polymerRoutes=read('data/polymerization-routes.json').routes;
const molecules=read('data/molecules.json');
// Include every dictionary entry, not only the last 26 hand-picked words.
walk(encyclopedia);walk(functionalGroups);walk(polymers);walk(polymerContent);walk(polymerRoutes);walk(molecules);

const authority=createReactionCatalogAuthority({polymerRoutes});
const ctx={records:molecules,polymerRecords:polymers};
for(const reaction of authority.entries())walk(reactionDetailInfo(reaction,ctx));
for(const group of reactionGroups(authority,{getState:()=> 'verified'}).groups){
  add(group.label);
  for(const entry of group.items){
    const d=entry.definition;
    const name=id=>molecules.find(item=>item.id===id)?.commonNameJa??molecules.find(item=>item.id===id)?.nameJa??id;
    const inputs=entry.kind==='normal'?d.reactants.map(x=>name(x.species)):d.feedSpecies.map(name);
    const outputs=entry.kind==='normal'?d.products.map(name):[polymers.find(x=>x.id===d.polymerId)?.nameJa??d.polymerId];
    add(`${inputs.join(' + ')} → ${outputs.join(' + ')}`);
    add(outputs.join(' ＋ '));
    add('‹ '+group.label+'に戻る');
  }
}

// UI literals (including interpolated text fragments) become source candidates;
// dynamic combinations are handled by the validated segment fallback.
for(const path of ['src/collection-ui.js','src/reaction-encyclopedia.js']){
  const source=readFileSync(new URL(path,root),'utf8');
  const literal=/(?<quote>['"`])(?<body>(?:\\.|(?!\k<quote>)[^\\])*?)\k<quote>/gs;
  // Matching across lines can swallow unrelated quoted strings and silently
  // omit visible UI labels such as 製作する and 材料不足.
  for(const line of source.split(/\r?\n/))for(const match of line.matchAll(literal)){
    let value=match.groups.body;
    value=value.replace(/\$\{[^}]*\}/g,'');
    value=value.replace(/\\(['"`\\])/g,'$1');
    if(value.length<=180&&!/[{};`]/.test(value))add(value);
  }
}

// Some UI strings depend on the number/entry, but the Kanji phrase is stable.
for(const value of [
  // Reviewed alternatives: these compounds have context-dependent readings
  // even when not present as a complete source sentence yet.
  '制作','構想上',
  '観察してみよう：','LABの条件：','原子数の合う反応式','材料と構成単位の対応',
  '見つかった分子','見つかる部品','代表的な繰り返し単位',
  '二種類の単量体由来部分を含む代表的な配列です。実際の組成比や並び方を示すものではありません。',
  'フェノール環がメチレン橋でつながる有限の分岐例です。硬化後の架橋網目全体を再現した模型ではありません。',
])add(value);

process.stdout.write(JSON.stringify([...found].sort(),null,0));
