import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {ENCYCLOPEDIA_TERM_CATALOG} from '../src/encyclopedia-terms.js';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {reactionDetailInfo} from '../src/reaction-encyclopedia.js';
import {GROUP_PREVIEW_SPECS} from '../src/reaction-book-visual.js';

// The catalog is the sole source for meanings and historical reference IDs.

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const json=async path=>JSON.parse(await readFile(resolve(ROOT,path),'utf8'));
const corpus=[];
function add(scope,id,text){if(typeof text==='string'&&text.trim())corpus.push({scope,id,text});}
function detailText(scope,id,details){
  for(const [index,part]of(details??[]).entries()){
    add(scope,`${id}#${index}:title`,part.title);
    add(scope,`${id}#${index}:body`,part.body);
  }
}
const encyclopedia=await json('data/encyclopedia.json');
const polymers=await json('data/polymer-encyclopedia.json');
const groups=await json('data/functional-groups.json');
const moleculeRecords=await json('data/molecules.json');
const polymerRecords=await json('data/polymers.json');
const routes=(await json('data/polymerization-routes.json')).routes;

for(const [id,item]of Object.entries(encyclopedia.molecules??{})){
  add('分子・概要',id,item.description);
  detailText('分子・詳細',id,item.details);
}
for(const [id,item]of Object.entries(encyclopedia.parts??{}))add('部品・概要',id,item.description);
for(const item of groups)add('部品・詳しく',item.id,item.description);
for(const [id,text]of Object.entries(encyclopedia.noteDefinitions??{}))add('分子・注釈',id,text);
for(const item of polymers){
  add('高分子・概要',item.id,item.description);
  detailText('高分子・詳細',item.id,item.details);
  for(const [field,text]of Object.entries(item.education??{}))add('高分子・学習',`${item.id}:${field}`,text);
}
for(const route of routes)add('高分子・工程',route.routeId,route.processLabel);
// These formation/topology labels are selected in collection-ui.js from record
// metadata, so they do not appear in the encyclopedia JSON prose fields.
for(const term of ['付加重合','共重合','開環重合','縮合重合','縮合による網目形成','線状','共重合体','網目状'])add('高分子・分類',term,term);
for(const term of ['酸化','燃焼','エステル化','ハロゲン化','縮合','重合','加水分解','付加','水和','置換','開環','環化','脱水','その他'])add('反応・分類',term,term);
for(const [id,spec]of Object.entries(GROUP_PREVIEW_SPECS))add('反応・分類',id,spec.caption);
const authority=createReactionCatalogAuthority({polymerRoutes:routes});
for(const entry of authority.entries()){
  const detail=reactionDetailInfo(entry,{records:moleculeRecords,polymerRecords});
  if(!detail)throw Error(`Missing reaction explanation: ${entry.reactionId}`);
  for(const field of ['bondChange','conditionSummary','byproductNote'])add('反応・詳細',`${entry.reactionId}:${field}`,detail[field]);
  for(const [index,text]of detail.conditions.entries())add('反応・詳細',`${entry.reactionId}:condition${index}`,text);
}

const terms=new Map();
const get=term=>{
  if(!terms.has(term))terms.set(term,{term,editorialMeaning:null,popupAreas:[],reference:null,candidateWave:null});
  return terms.get(term);
};
for(const entry of ENCYCLOPEDIA_TERM_CATALOG){
  const item=get(entry.term);
  item.editorialMeaning=entry.meaning;
  if(entry.summaryScope!==null){
    item.popupAreas.push(entry.summaryScope==='parts'?'部品・概要':'分子・概要／部品・概要');
  }
  if(entry.referencePageId)item.reference={pageId:entry.referencePageId};
  item.candidateWave=entry.candidateWave;
}

const scopeOrder=['分子・概要','分子・詳細','分子・注釈','部品・概要','部品・詳しく','反応・分類','反応・詳細','高分子・分類','高分子・概要','高分子・詳細','高分子・学習','高分子・工程'];
const entries=[];
for(const item of terms.values()){
  const matches=corpus.filter(row=>row.text.includes(item.term));
  if(item.candidateWave&&!matches.length)continue;
  const areas=scopeOrder.map(scope=>({scope,fields:matches.filter(row=>row.scope===scope).length})).filter(row=>row.fields);
  const popup=item.popupAreas.length>0,external=!!item.reference;
  const coverage=popup&&external?'ポップアップ＋外部リンク':popup?'ポップアップのみ':external?'外部リンクのみ':'未登録';
  const priority=matches.length===0?'P3':!popup&&external?'P0':!popup&&item.candidateWave===1?'P0':!popup?'P1':external?'P1':'P2';
  entries.push({
    term:item.term,priority,coverage,meaning:item.editorialMeaning,
    disposition:matches.length?'採用（現行本文で使用）':'保留（現行本文で未使用）',
    definitionReady:!!item.editorialMeaning,
    popupAreas:item.popupAreas,externalPageId:item.reference?.pageId??null,
    appearanceFields:matches.length,areas,
    examples:matches.slice(0,5).map(row=>`${row.scope}:${row.id}`),
    action:!matches.length?'現在は表示不要・本文で採用時に再確認':'第4段階でアプリ内解説に接続済み',
  });
}
entries.sort((a,b)=>a.priority.localeCompare(b.priority)||b.appearanceFields-a.appearanceFields||a.term.localeCompare(b.term,'ja'));
if(entries.length!==new Set(entries.map(row=>row.term)).size)throw Error('Duplicate term');
const counts=Object.fromEntries(['P0','P1','P2','P3'].map(p=>[p,entries.filter(row=>row.priority===p).length]));
const coverageCounts=Object.fromEntries(['ポップアップ＋外部リンク','ポップアップのみ','外部リンクのみ','未登録'].map(x=>[x,entries.filter(row=>row.coverage===x).length]));
const definitionReadyCount=entries.filter(row=>row.definitionReady).length;
const activeCount=entries.filter(row=>row.disposition.startsWith('採用')).length;
const inventory={schemaVersion:2,source:'Unified encyclopedia term catalog + 4 encyclopedia sections',reactionPaths:authority.count(),proseFields:corpus.length,counts,coverageCounts,definitionReadyCount,activeCount,entries};
const ledgerJSON=JSON.stringify(inventory,null,2)+'\n';
const escapeCell=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');
const ledgerMD=[
  '# Molecule Craft 用語台帳（図鑑4区分）',
  '',
  '> 自動生成ファイル。用語の説明本文・従来の表示区分・出典確認用の参考IDは `src/encyclopedia-term-catalog.js` に一元管理し、本文中の出現実績と採否をこの台帳へ反映する。参考IDはゲームの外部リンクには使用しない。',
  '',
  '## 対象と読み方',
  '',
  '- 対象：分子142件、部品（概要と官能基説明）、反応54経路、高分子25件の実際の表示説明文。反応の分類ラベル、高分子の学習欄・工程欄・分類ラベルも含む。',
  '- 224語すべての説明原稿とルビを辞書に整備済み。4図鑑の本文からアプリ内の用語説明を開く。概要内は最大3語、詳しい説明は段落あたり最大4語。',
  '- **ポップアップあり／外部リンクのみ／未登録**は第4段階より前の**旧表示状況**であり、現在のUIではない。',
  '- 現行本文に登場する語は「採用」、現在使っていない参考用語は「保留」とした。部分一致の数え上げであり、具体的な表示場所は第4段階で文脈を確認する。',
  '- 「出現欄数」は単純な部分文字列検索で、同じ欄の複数回出現は1欄。複合語中の一致を含むため、実装時の語境界・文脈確認が必要。',
  '- P0＝現行の表示がリンク頼みか未登録の重要語、P1＝その他の表示整理候補、P2＝すでにポップアップがある語、P3＝現行文で未使用の保留語。これは第4段階向け優先度であり、執筆残数ではない。',
  '',
  `監査した説明文：**${corpus.length}欄**（反応 **${authority.count()}経路**）。台帳：**${entries.length}語**。優先度 P0 ${counts.P0} / P1 ${counts.P1} / P2 ${counts.P2} / P3 ${counts.P3}。`,
  '',
  `**第1〜3段階の結果：説明原稿 ${definitionReadyCount}/${entries.length}語。現行本文で採用 ${activeCount}語、未使用の予備 ${entries.length-activeCount}語。**`,
  '',
  `第4段階前の表示履歴：ポップアップ＋外部リンク ${coverageCounts['ポップアップ＋外部リンク']}語、ポップアップのみ ${coverageCounts['ポップアップのみ']}語、外部リンクのみ ${coverageCounts['外部リンクのみ']}語、未登録 ${coverageCounts['未登録']}語。現在は外部辞書へのリンクを作らない。`,
  '',
  '## 作業順',
  '',
  '1. 【完了】既存96語の解説を校正し、外部リンク依存53語と未登録候補75語の説明原稿を整備。',
  '2. 【完了】現行本文への出現を監査し、使用中と保留の候補を区別。表記違い（シス／cisなど）も同じ意味で統一。',
  '3. 【実装済み・公開前】4図鑑へ説明を接続し、浜島書店へのプレイヤー向けリンクを撤去。実機確認を経て公開する。',
  '',
  '**第4段階での優先接続例（20語）**：二重結合、単結合、三重結合、電子対、孤立電子対、極性、水素結合、イオン、官能基、エステル、エステル結合、酸性、塩基性、触媒、ラジカル、主鎖、側鎖、構成単位、モノマー、分子量。',
  '',
];
for(const priority of ['P0','P1','P2','P3']){
  ledgerMD.push(`## ${priority}（${counts[priority]}語）`,'','| 用語 | 旧表示の記録 | 出現欄数と区分 | 整備済みの説明原稿 | 対応状況 |','|---|---|---|---|---|');
  for(const row of entries.filter(row=>row.priority===priority)){
    const areas=row.areas.map(area=>`${area.scope} ${area.fields}`).join('、')||'現行文なし';
    ledgerMD.push(`| ${escapeCell(row.term)} | ${row.coverage}${row.externalPageId?`（参考ID ${row.externalPageId}）`:''} | ${escapeCell(areas)} | ${escapeCell(row.meaning)} | ${row.action} |`);
  }
  ledgerMD.push('');
}
ledgerMD.push('## 残すべき設計上の注意','','- `タンパク質`／`たんぱく質`、`モノマー`／`単量体`、`反復単位`／`繰り返し単位`などの表記ゆれは、文面置換とは別に語の同一性を定義する。','- `酸化`が`二酸化炭素`に、`極性`が`無極性`に含まれる場合など、部分一致を無条件にボタン化しない。','- 反応詳細はカタログから動的生成される説明も含めた。新しい反応経路・高分子経路が加わったら台帳を再生成する。','','実装用の全件データは [`encyclopedia-term-ledger.json`](./encyclopedia-term-ledger.json) にあり、語ごとに最大5件の実際の参照箇所を記録している。','');
const ledgerMarkdown=ledgerMD.join('\n');

for(const [path,content]of [['docs/encyclopedia-term-ledger.json',ledgerJSON],['docs/encyclopedia-term-ledger.md',ledgerMarkdown]]){
  if(process.argv.includes('--check')){
    if(await readFile(resolve(ROOT,path),'utf8').catch(()=>null)!==content)throw Error(`${path} is stale; regenerate with node scripts/build-encyclopedia-term-ledger.mjs`);
  }else await writeFile(resolve(ROOT,path),content);
}
console.log(`Encyclopedia term ledger: ${entries.length} terms / ${corpus.length} prose fields / ${authority.count()} reaction paths (P0 ${counts.P0}, P1 ${counts.P1}, P2 ${counts.P2}, P3 ${counts.P3})`);
