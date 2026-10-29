export const COLLECTION_CATEGORIES = Object.freeze({
  inorganic:'基本無機', hydrocarbon:'炭化水素', alcohol:'アルコール・ポリオール', ether:'エーテル',
  carbonyl:'アルデヒド・ケトン', acid:'カルボン酸', ester:'エステル・酸無水物', nitrogen:'窒素化合物',
  aromatic:'芳香族', sulfur:'硫黄化合物', halogen:'ハロゲン化合物',
});
export function collectionCategory(record){
  const category=record.category??'';
  if(category==='basic-inorganic')return 'inorganic';
  if(category.includes('aromatic'))return 'aromatic';
  if(category.includes('halogenated'))return 'halogen';
  if(['alcohol','polyol'].includes(category))return 'alcohol';
  if(category.includes('ether')&&!category.includes('thio'))return 'ether';
  if(['thiol','thioether'].includes(category))return 'sulfur';
  if(category.includes('aldehyde')||category==='ketone')return 'carbonyl';
  if(category==='amino-acid'||['amine','diamine','amide','nitrile'].includes(category))return 'nitrogen';
  if(category==='ester'||category==='acid-anhydride')return 'ester';
  if(category.includes('acid'))return 'acid';
  return 'hydrocarbon';
}
export function moleculeDisplayName(record){return record.commonNameJa??record.nameJa;}
export function graphSummary(record){
  const hydrogens=record.atoms.map(()=>0);
  record.bonds.forEach(([a,b])=>{if(record.atoms[a]==='H')hydrogens[b]++;if(record.atoms[b]==='H')hydrogens[a]++;});
  let indices=record.atoms.map((_,i)=>i).filter(i=>record.atoms[i]!=='H');
  if(!indices.length)indices=record.atoms.map((_,i)=>i);
  return {nodes:indices.map(index=>({index,element:record.atoms[index],hydrogens:hydrogens[index]})),bonds:record.bonds.filter(([a,b])=>indices.includes(a)&&indices.includes(b))};
}
