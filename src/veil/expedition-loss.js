const LOSS_ELEMENTS=Object.freeze(['H','C','N','O','P','S','F','Cl']);
const BASE_DUST_ELEMENTS=new Set(['H','C','O']);

const expeditionElements=units=>LOSS_ELEMENTS.filter(element=>BASE_DUST_ELEMENTS.has(element)||Object.hasOwn(units??{},element));

export function expeditionLoss(units,rate){
  const elements=expeditionElements(units),exact=elements.map((el,index)=>({el,index,value:(units?.[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));
  let remaining=Math.floor(elements.reduce((sum,el)=>sum+(units?.[el]??0),0)*rate)-elements.reduce((sum,el)=>sum+lost[el],0);
  for(const item of exact.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index)){
    if(remaining<=0)break;
    if(lost[item.el]<(units?.[item.el]??0)){lost[item.el]++;remaining--;}
  }
  return lost;
}
