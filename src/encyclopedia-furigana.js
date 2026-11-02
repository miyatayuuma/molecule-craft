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
