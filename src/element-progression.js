// Discovery counts are distinct DB ids, not repeated completions or atom counts.
export const ELEMENT_UNLOCKS = Object.freeze([
  {symbol:'H', name:'水素', discoveries:0},
  {symbol:'C', name:'炭素', discoveries:0},
  {symbol:'O', name:'酸素', discoveries:0},
  {symbol:'N', name:'窒素', discoveries:3},
  {symbol:'Cl', name:'塩素', discoveries:6},
  {symbol:'S', name:'硫黄', discoveries:10},
  {symbol:'P', name:'リン', discoveries:15},
  {symbol:'F', name:'フッ素', discoveries:15},
].map(Object.freeze));

export function availableElements(discoveries, legacyElements = []) {
  const legacy = new Set(legacyElements);
  return ELEMENT_UNLOCKS.filter(item=>item.discoveries<=discoveries||legacy.has(item.symbol)).map(item=>item.symbol);
}

export function nextElementUnlock(discoveries, available) {
  const unlocked = new Set(available);
  const pending = ELEMENT_UNLOCKS.filter(item=>!unlocked.has(item.symbol));
  if(!pending.length)return null;
  const target = Math.min(...pending.map(item=>item.discoveries));
  return {elements:pending.filter(item=>item.discoveries===target),target,remaining:Math.max(0,target-discoveries)};
}

export function syncElementStocks(root = document, elements = {}) {
  for (const button of root.querySelectorAll('#element-palette [data-element]')) {
    const symbol=button.dataset.element,stock=button.querySelector('[data-element-stock]');
    if(!stock)continue;
    const count=Math.max(0,Number(elements[symbol]??0));
    stock.textContent=String(count);button.dataset.stockCount=String(count);
    button.disabled=button.hidden||count<=0;
    const item=ELEMENT_UNLOCKS.find(item=>item.symbol===symbol);
    if(item)button.setAttribute('aria-label',`${item.name}（${symbol}） 在庫 ${count}`);
  }
}

// Enhance, never replace, the static HTML palette. A collection-data failure
// keeps already explored elements usable; exploration remains authoritative.
export function createElementPalette(root = document, {canUse=()=>true} = {}) {
  const buttons=[...root.querySelectorAll('#element-palette [data-element]')];
  let available=new Set(availableElements(0));
  const extra=root.querySelector('#show-extra-elements'),visible=symbol=>['H','C','O'].includes(symbol)||!!extra?.checked;
  function render(){
    for(const button of buttons){
      const item=ELEMENT_UNLOCKS.find(item=>item.symbol===button.dataset.element);
      if(!item)continue;
      button.hidden=!visible(item.symbol)||!available.has(item.symbol)||!canUse(item.symbol);button.disabled=button.hidden||Number(button.dataset.stockCount??0)<=0;
      button.style.order=ELEMENT_UNLOCKS.indexOf(item);
      button.title=`${item.name}（${item.symbol}）を追加`;
    }
  }
  extra?.addEventListener('change',render);
  render();
  return {
    canUse:symbol=>visible(symbol)&&available.has(symbol)&&canUse(symbol),
    update(state){
      available=new Set(state.unlockedElements());
      render();
    },
    fallback(){available=new Set(ELEMENT_UNLOCKS.map(item=>item.symbol));render();},
  };
}
