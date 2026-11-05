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

// Every long encyclopedia sentence has its own context-sensitive readings in
// encyclopedia-extra-furigana.json. The old list of 26 science terms omitted
// most Kanji, and a nearby-Kanji restriction silently omitted compounds.
const KANJI=/[一-龯々]/u;
export function createCompleteFuriganaIndex(data){
 const texts=data?.texts??{},words=new Map();
 const add=(surface,reading)=>{if(!words.has(surface))words.set(surface,new Map());const counts=words.get(surface);counts.set(reading,(counts.get(reading)??0)+1);};
 for(const annotations of Object.values(texts)){
   let chain='',pronunciation='',end=-1;
   for(const [offset,surface,reading] of annotations){
     add(surface,reading);
     if(offset!==end){if(chain)add(chain,pronunciation);chain='';pronunciation='';}
     chain+=surface;pronunciation+=reading;end=offset+surface.length;
   }
   if(chain)add(chain,pronunciation);
 }
 const lookup=new Map([...words].map(([surface,readings])=>[
   surface,[...readings].sort((a,b)=>b[1]-a[1])[0][0]
 ]));
 const lengths=[...new Set([...lookup.keys()].map(surface=>surface.length))].sort((a,b)=>b-a);
 return {texts,lookup,lengths};
}
export function completeFuriganaSegments(value,index){
 const text=String(value??'');
 if(!index)return [{kind:'text',text}];
 if(Object.prototype.hasOwnProperty.call(index.texts,text))return furiganaSegmentsForRange(text,index.texts[text]);
 // Short UI labels can include changing counts and translated names. Match
 // the longest known Kanji span, preserving all non-Kanji characters exactly.
 const segments=[];
 const addPlain=part=>{const last=segments.at(-1);if(last?.kind==='text')last.text+=part;else segments.push({kind:'text',text:part});};
 for(let i=0;i<text.length;){
   if(!KANJI.test(text[i])){addPlain(text[i++]);continue;}
   let match=null;
   for(const length of index.lengths){
     const candidate=text.slice(i,i+length);
     if(index.lookup.has(candidate)){match=candidate;break;}
   }
   if(match){segments.push({kind:'ruby',text:match,reading:index.lookup.get(match)});i+=match.length;}
   else addPlain(text[i++]);
 }
 return segments;
}
export function appendCompleteFuriganaText(host,value,index){
 const doc=host.ownerDocument??document;
 for(const part of completeFuriganaSegments(value,index)){
   if(part.kind==='text'){host.append(doc.createTextNode(part.text));continue;}
   const ruby=doc.createElement('ruby'),reading=doc.createElement('rt');
   ruby.append(doc.createTextNode(part.text));reading.textContent=part.reading;ruby.append(reading);host.append(ruby);
 }
 return host;
}
