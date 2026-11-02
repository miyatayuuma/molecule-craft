// Short, age-appropriate definitions for selected words in molecule summaries.
// This is deliberately not a general kanji reader or a chemical dictionary.
const DEFINITIONS=Object.freeze([
  ['燃料電池','燃料の力を使って、電気をつくる装置。',2],
  ['不完全燃焼','ものが十分に燃えきらないこと。',2],
  ['光合成','植物が光の力を使って、栄養をつくること。',2],
  ['植物ホルモン','植物の育ち方などを調節する物質。',2],
  ['芳香族化合物','ベンゼンのような特別な輪の構造を持つ物質の仲間。',2],
  ['炭素骨格','炭素の原子がつながってできる、分子の土台。',2],
  ['半導体','電気の流れやすさを調節できる材料。',2],
  ['微生物','目に見えないほど小さな生き物。',2],
  ['揮発性','蒸発して気体になりやすい性質。',2],
  ['反応性','ほかの物質と変化を起こしやすい性質。',2],
  ['刺激臭','鼻や目がツンとするようなにおい。',2],
  ['有機合成','炭素を含む物質を、反応を使ってつくること。',2],
  ['共重合体','違う種類の小さな分子がつながった高分子。',2],
  ['共重合','違う種類の小さな分子をつないで高分子をつくること。',2],
  ['酸化','物質が酸素と結びつくなどして、電子のやり取りが起きる変化。',2],
  ['燃焼','ものが燃えて、熱や光を出す反応。',2],
  ['分子式','分子にどの原子が何個あるかを記号で表したもの。',2],
  ['主成分','その中に特に多く含まれているもの。',1],
  ['原料','何かをつくるための、もとになる材料。',1],
  ['製造','ものをつくること。',1],
  ['濃度','あるものが、どのくらいの割合で混ざっているか。',1],
  ['微量','ほんの少しの量。',1],
  ['厳重','十分に気をつけて、しっかり行うこと。',1],
  ['循環','ぐるぐる巡って、また戻ってくること。',1],
  ['占める','全体の中で、その部分がどれくらいあるかを表す言い方。',1],
  ['抑える','増えたり強くなったりしないようにすること。',1],
  ['妨げる','うまく進むのをじゃますること。',1],
  ['由来','どこから来たか、何がもとになったか。',1],
  ['影響','あることが、ほかのことに変化を与えること。',1],
  ['代謝','体の中で物質をつくったり、分解したりする働き。',2],
  ['発酵','微生物の働きで、物質が別のものに変わること。',2],
  ['抽出','混ざったものの中から、ほしい成分を取り出すこと。',2],
  ['溶媒','ほかの物質を溶かすために使う液体など。',2],
  ['冷媒','熱を運んで、ものを冷やすための物質。',2],
  ['沸点','液体が沸騰する温度。',2],
  ['樹脂','プラスチックなどをつくる材料となる物質。',2],
  ['重合','小さな分子が次々につながり、大きな分子になること。',2],
  ['分解','一つの物質が、別の物質に分かれること。',1],
  ['揮発','液体が蒸発して気体になること。',2],
  ['肥料','植物を育てるために土などへ加える栄養。',1],
  ['有毒','体に害を与えることがある性質。',1],
  ['有害','体や環境に悪い影響があること。',1],
  ['保存料','食べ物などが傷みにくくなるように加えるもの。',2],
  ['発泡材','小さな泡をたくさん含んだ材料。',2],
  ['原子','物質をつくる、とても小さな粒。',1],
  ['元素','原子の種類のこと。',1],
  ['化合物','違う元素の原子が結びついてできた物質。',2],
  ['酸性雨','空気中の物質の影響で、酸性が強くなった雨。',2],
  ['医薬品','病気の治療などに使う薬。',1],
  ['工業','工場などでたくさんのものをつくる仕事。',1],
]);

const MATCH_ORDER=[...DEFINITIONS].sort((a,b)=>b[0].length-a[0].length);

const PART_DEFINITIONS=Object.freeze([
  ['水素イオン','水素の原子が電子を失ってできる、小さな粒。',2],
  ['カルボキシ基','酸としての働きに関わる、分子の部品。',2],
  ['たんぱく質','体や筋肉などをつくる、大切な物質。',2],
  ['アミノ酸','たんぱく質の材料になる小さな分子。',2],
  ['尿素','体の中ででき、尿にも含まれる物質。肥料にも使われる。',2],
  ['炭素','多くの分子の骨組みになる元素。',2],
  ['電子','原子にある、とても小さな粒。',2],
  ['酸素','呼吸や燃焼に関わる元素。',2],
  ['消毒','ばい菌などの数を減らすこと。',1],
  ['塗料','色をつけたり、表面を守ったりする材料。',1],
  ['性質','ものがもつ特徴のこと。',1],
  ['糖','砂糖やブドウ糖などの仲間。',1],
  ['合成','材料を組み合わせて、別の物質をつくること。',2],
  ['油脂','油や脂肪のこと。',2],
  ['繊維','糸や布になる細長い材料。',2],
  ['香料','ものに香りをつける材料。',1],
  ['出発点','ものごとが始まるところ。',1],
  ['共通','いくつかのものに同じ特徴があること。',1],
  ['周囲','そのもののまわり。',1],
  ['反応','物質が別の物質に変わること。',2],
]);
const PART_MATCH_ORDER=[...DEFINITIONS,...PART_DEFINITIONS].sort((a,b)=>b[0].length-a[0].length);

function glossarySegments(value,matchOrder,{limit=3}={}){
  const text=String(value??'');
  const found=[],seen=new Set();
  for(let index=0;index<text.length;){
    const item=matchOrder.find(([word])=>text.startsWith(word,index));
    if(!item){index++;continue;}
    const [word,meaning,priority]=item;
    // 二酸化炭素などの分子名の一部を「酸化」という動作として説明しない。
    if(word==='酸化'&&(/[一二]$/.test(text.slice(0,index))&&text.startsWith('炭素',index+word.length)||/^(物|剤|数|力)/.test(text.slice(index+word.length)))){
      index+=word.length;continue;
    }
    if(!seen.has(word)){found.push({index,word,meaning,priority});seen.add(word);}
    index+=word.length;
  }
  const selected=found.sort((a,b)=>b.priority-a.priority||a.index-b.index).slice(0,Math.max(0,limit)).sort((a,b)=>a.index-b.index);
  const result=[];let cursor=0;
  for(const {index,word,meaning} of selected){
    if(index>cursor)result.push({kind:'text',text:text.slice(cursor,index)});
    result.push({kind:'term',text:word,meaning});cursor=index+word.length;
  }
  if(cursor<text.length)result.push({kind:'text',text:text.slice(cursor)});
  return result;
}

export function moleculeSummaryGlossarySegments(value,options){
  return glossarySegments(value,MATCH_ORDER,options);
}

export function partSummaryGlossarySegments(value,options){
  return glossarySegments(value,PART_MATCH_ORDER,options);
}
