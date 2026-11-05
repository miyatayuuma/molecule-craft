// Offset-based readings keep the encyclopedia's source descriptions unchanged.
// A reading is shown only when it still matches the exact source substring.
export function furiganaSegmentsForRange(value,annotations=[],start=0,end=String(value??'').length){
  const text=String(value??'');
  const from=Math.max(0,Math.min(text.length,start));
  const to=Math.max(from,Math.min(text.length,end));
  const segments=[];
  let cursor=from;
  for(const item of annotations){
    if(!Array.isArray(item)||item.length!==3)continue;
    const [offset,surface,reading]=item;
    if(!Number.isInteger(offset)||typeof surface!=='string'||!surface||typeof reading!=='string'||!reading)continue;
    const finish=offset+surface.length;
    if(offset<cursor||finish>to||text.slice(offset,finish)!==surface)continue;
    if(offset>cursor)segments.push({kind:'text',text:text.slice(cursor,offset)});
    segments.push({kind:'ruby',text:surface,reading});
    cursor=finish;
  }
  if(cursor<to)segments.push({kind:'text',text:text.slice(cursor,to)});
  return segments;
}

// Independently reviewed, unambiguous science vocabulary for the reaction and
// polymer books. Never infer a reading from a tokenizer or from a lone kanji.
const SCIENCE_READINGS=Object.freeze({
 '二重結合':'にじゅうけつごう','単結合':'たんけつごう',
 '分子式':'ぶんししき','高分子':'こうぶんし','構成単位':'こうせいたんい','炭素鎖':'たんそさ',
 '化学反応':'かがくはんのう','原子':'げんし','分子':'ぶんし','結合':'けつごう',
 '反応':'はんのう','生成物':'せいせいぶつ','原料':'げんりょう','酸性':'さんせい',
 '塩基性':'えんきせい','加熱':'かねつ','触媒':'しょくばい','構造':'こうぞう',
 '酸素':'さんそ','水素':'すいそ','炭素':'たんそ','縮合':'しゅくごう',
 '重合':'じゅうごう','模型':'もけい','条件':'じょうけん','工程':'こうてい'
});
const SCIENCE_TERMS=Object.keys(SCIENCE_READINGS).sort((a,b)=>b.length-a.length);
export function reviewedScienceReadingSegments(value){
 const text=String(value??''),segments=[];let cursor=0;
 while(cursor<text.length){
   const term=SCIENCE_TERMS.find(word=>{
     if(!text.startsWith(word,cursor))return false;
     const before=text[cursor-1]??'',after=text[cursor+word.length]??'';
     // Avoid splitting an unknown compound (e.g. 水素結合 / 化学反応式).
     return !/[一-龯々]/u.test(before)&&!/[一-龯々]/u.test(after);
   });
   if(term){segments.push({kind:'ruby',text:term,reading:SCIENCE_READINGS[term]});cursor+=term.length;}
   else{const last=segments.at(-1);if(last?.kind==='text')last.text+=text[cursor];else segments.push({kind:'text',text:text[cursor]});cursor++;}
 }
 return segments;
}
export function appendReviewedScienceText(host,value){
 const doc=host.ownerDocument??document;
 for(const part of reviewedScienceReadingSegments(value)){
   if(part.kind==='text'){host.append(doc.createTextNode(part.text));continue;}
   const ruby=doc.createElement('ruby'),reading=doc.createElement('rt');
   ruby.append(doc.createTextNode(part.text));reading.textContent=part.reading;ruby.append(reading);host.append(ruby);
 }
 return host;
}
