const CHEMTERM_BASE_URL='https://www.hamajima.co.jp/rika/chemterm/';

const TERM_PAGE_IDS=Object.freeze({
  '共有結合':'42222001',
  '電子対':'42222101',
  '不対電子':'42222102',
  '共有電子対':'42222103',
  '非共有電子対':'42222104',
  '孤立電子対':'42222105',
  '単結合':'42222201',
  '二重結合':'42222202',
  '三重結合':'42222203',
  '配位結合':'42223001',
  '極性':'42224001',
  '電気陰性度':'42224101',
  '無極性分子':'42224201',
  '極性分子':'42224202',
  '分子間力':'42225001',
  '重合':'42227008',
  'モノマー':'42227005',
  '縮合重合':'42227010',
  'ポリエチレン':'54214103',
  'ポリ塩化ビニル':'54214106',
  'ナイロン':'54213103',
  'モノマー':'42227005',
  '縮合重合':'42227010',
  'ポリエチレン':'54214103',
  'ポリ塩化ビニル':'54214106',
  'ナイロン':'54213103',
  'ポリエステル':'54213201',
  '水素結合':'51112201',
  '官能基':'54112101',
  '構造異性体':'54113101',
  'シス-トランス異性体':'54113202',
  '混成軌道':'54119101',
  'σ結合':'54119102',
  'π結合':'54119103',
  'ベンゼン環':'54131001',
  'アルカン':'54115001',
  'アルケン':'54116001',
  'アルキン':'54117001',
  'アルコール':'54121101',
  'アルデヒド':'54122101',
  'アミン':'54134001',
  'アミノ酸':'54225001',
  'エステル':'54124001',
  'エステル結合':'54124002',
  '塩基':'43211005',
  '塩基性':'43211003',
  'カルボニル化合物':'54122001',
  'カルボン酸':'54123001',
  'ケトン':'54122201',
  '還元':'43221002',
  '還元剤':'43223002',
  '酸化':'43221001',
  '酸化還元反応':'43221003',
  '酸化剤':'43223001',
  '酸化数':'43222001',
  '酸化物':'53112402',
  '酸化力':'43223004',
  '炭化水素':'54112009',
  '付加重合':'42227009',
  '付加反応':'54116301',
  '共重合':'54211204',
  '置換反応':'54115301',
  '沸点':'41143101',
  '分子式':'42221006',
  '芳香族化合物':'54112004',
  '溶媒':'43113102',
  '双性イオン':'54225201',
});

export const HAMAJIMA_TERM_REFERENCES=Object.freeze(Object.fromEntries(
  Object.entries(TERM_PAGE_IDS).map(([term,pageId])=>[term,Object.freeze({
    term,
    pageId,
    url:`${CHEMTERM_BASE_URL}${pageId}.html`,
  })]),
));

const MATCH_TERMS=Object.keys(HAMAJIMA_TERM_REFERENCES).sort((left,right)=>
  [...right].length-[...left].length || (left<right?-1:left>right?1:0));

export function hamajimaTermReference(displayTerm){
  return Object.hasOwn(HAMAJIMA_TERM_REFERENCES,displayTerm)
    ? HAMAJIMA_TERM_REFERENCES[displayTerm]
    : null;
}

export function hamajimaTermSegments(value){
  const text=typeof value==='string'?value:String(value??'');
  const segments=[];
  let cursor=0,plainStart=0;
  while(cursor<text.length){
    const term=MATCH_TERMS.find(candidate=>text.startsWith(candidate,cursor));
    if(!term){cursor++;continue;}
    if(cursor>plainStart)segments.push({kind:'text',text:text.slice(plainStart,cursor)});
    segments.push({kind:'term',text:term,reference:HAMAJIMA_TERM_REFERENCES[term]});
    cursor+=term.length;
    plainStart=cursor;
  }
  if(plainStart<text.length)segments.push({kind:'text',text:text.slice(plainStart)});
  return segments;
}
