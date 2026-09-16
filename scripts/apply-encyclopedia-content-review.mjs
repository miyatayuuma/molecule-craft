import {readFile,writeFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
const write=async(path,text)=>writeFile(new URL(path,root),text);
const source=JSON.parse(await read('data/encyclopedia.json'));
const chunks=[];
for(let i=1;i<=6;i++)chunks.push(JSON.parse(await read(`tmp/encyclopedia-review-${i}.json`)));
const molecules={};
for(const chunk of chunks)for(const [id,entry] of Object.entries(chunk)){
  if(molecules[id])throw new Error(`duplicate reviewed molecule: ${id}`);
  molecules[id]=entry;
}
const tnt=molecules['2-4-6-trinitrotoluene'];
if(tnt?.details?.[0])tnt.details[0].body='2,4,6位の各NO₂基はN⁺/O⁻を含む等価なLewis寄与構造で表せる。これらは同じ電子状態を別々に表した寄与構造で、実在構造では電子密度が各O–N–O領域へ非局在化している。';
const sourceIds=Object.keys(source.molecules??{}),reviewIds=Object.keys(molecules);
if(sourceIds.length!==135||reviewIds.length!==135)throw new Error(`expected 135 molecules, source=${sourceIds.length}, review=${reviewIds.length}`);
const missing=sourceIds.filter(id=>!molecules[id]),extra=reviewIds.filter(id=>!source.molecules[id]);
if(missing.length||extra.length)throw new Error(`review id mismatch missing=${missing.join(',')} extra=${extra.join(',')}`);
const numbers=reviewIds.map(id=>molecules[id].number).sort((a,b)=>a-b);
if(numbers.some((number,index)=>number!==index+1))throw new Error('review numbers must be 1..135');
const sorted=Object.fromEntries(reviewIds.sort((a,b)=>molecules[a].number-molecules[b].number).map(id=>[id,molecules[id]]));
const output={
  schemaVersion:2,
  noteDefinitions:{
    model:'模型は結合情報から生成した教材用の配置で、実測構造そのものではありません。',
    aromatic:'芳香環に表示される水色の内円は、環全体に広がるπ電子を表す教材上の記号です。',
    resonance:'水色の共鳴補助表示は、複数のLewis構造で表される電子の非局在化を示します。二重結合が実際に往復しているという意味ではありません。',
    stereochemistry:'この図鑑ではcis/transや鏡像異性体を個別の収集対象にしていません。',
  },
  molecules:sorted,
  parts:source.parts,
};
await write('data/encyclopedia.json',`${JSON.stringify(output,null,2)}\n`);

let ui=await read('src/collection-ui.js');
ui=ui.replace("load('../data/encyclopedia.json?v=29').catch(()=>({molecules:{},parts:{}}))","load('../data/encyclopedia.json?v=30').catch(()=>({molecules:{},parts:{},noteDefinitions:{}}))");
ui=ui.replace("detail.append(el('p',entry(kind,id)?.description??record.learningNote??'この分子を図鑑に登録しました。','dex-description'));","const catalogEntry=entry(kind,id)??{};\n    detail.append(el('p',catalogEntry.description??'この分子を図鑑に登録しました。','dex-description'));");
const old=`    const extra=section('くわしく');extra.append(el('p',\`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}\`),el('p',\`IUPAC: ${record.iupacNameEn}\`));\n    if(record.aliases?.length)extra.append(el('p',\`別名：${record.aliases.join('、')}\`));\n    if(record.learningNote)extra.append(el('p',record.learningNote));\n    const discovered=state.moleculeEntry(id);extra.append(el('p',\`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}\`));\n    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length){extra.append(el('h4','見つかる部品'),tags);}\n    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives)extra.append(button(state.hasMolecule(item.id)?moleculeDisplayName(item):'???',()=>state.hasMolecule(item.id)&&showDetail('molecules',item.id),'collection-tag'));}\n    extra.append(el('p','模型は結合情報からつくった教材用の配置です。実測構造ではありません。水色の内円は芳香環に広がるπ電子を表す記号です。cis/transや鏡像異性体は分けて収集していません。'));`;
const replacement=`    const extra=section('くわしく');extra.append(el('p',\`${record.nameEn} · ${COLLECTION_CATEGORIES[collectionCategory(record)]}\`),el('p',\`IUPAC: ${record.iupacNameEn}\`));\n    if(record.aliases?.length)extra.append(el('p',\`別名：${record.aliases.join('、')}\`));\n    const detailSections=Array.isArray(catalogEntry.details)?catalogEntry.details:[];\n    if(detailSections.length){const chemistry=el('div',null,'chemistry-detail');chemistry.append(el('h4','化学のポイント'));for(const item of detailSections){const sectionNode=el('section',null,'chemistry-detail-section');sectionNode.append(el('h5',item.title),el('p',item.body));chemistry.append(sectionNode);}extra.append(chemistry);}\n    const discovered=state.moleculeEntry(id);extra.append(el('h4','発見'),el('p',\`発見 ${discovered.order}番目${discovered.at?` · ${new Date(discovered.at).toLocaleDateString('ja-JP')}`:''}\`));\n    const tags=el('div',null,'collection-tags');for(const match of matches)tags.append(button(groupById(match.id).nameJa,()=>showDetail('groups',match.id),'collection-tag'));if(matches.length){extra.append(el('h4','見つかる部品'),tags);}\n    const relatives=state.isomersOf(record);if(relatives.length){extra.append(el('h4','同じ分子式の仲間'));for(const item of relatives)extra.append(button(state.hasMolecule(item.id)?moleculeDisplayName(item):'???',()=>state.hasMolecule(item.id)&&showDetail('molecules',item.id),'collection-tag'));}\n    const noteKeys=['model',...(Array.isArray(catalogEntry.notes)?catalogEntry.notes:[])],noteTexts=noteKeys.map(key=>data.encyclopedia.noteDefinitions?.[key]).filter(Boolean);\n    if(noteTexts.length){const noteHost=el('div',null,'model-collection-notes');noteHost.append(el('h4','模型・収録について'));for(const text of noteTexts)noteHost.append(el('p',text));extra.append(noteHost);}`;
if(!ui.includes(old))throw new Error('collection detail source contract changed; expected block not found');
ui=ui.replace(old,replacement);
if(ui.includes('record.learningNote'))throw new Error('learningNote remains a Collection UI content authority');
await write('src/collection-ui.js',ui);
console.log(`Applied Encyclopedia content architecture v2 for ${reviewIds.length} molecules.`);
