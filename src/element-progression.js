// Presentation order and labels only. Gameplay access is owned by resources.canUseElement().
export const ELEMENT_PRESENTATION = Object.freeze([
  {symbol:'H', name:'水素', color:'#f8fafc'},
  {symbol:'C', name:'炭素', color:'#64748b'},
  {symbol:'O', name:'酸素', color:'#ef4444'},
  {symbol:'N', name:'窒素', color:'#3b82f6'},
  {symbol:'Cl', name:'塩素', color:'#16a34a'},
  {symbol:'S', name:'硫黄', color:'#eab308'},
  {symbol:'P', name:'リン', color:'#f97316'},
  {symbol:'F', name:'フッ素', color:'#22c55e'},
].map(Object.freeze));

// Compatibility alias for presentation consumers. There are no discovery-count gates.
export const ELEMENT_UNLOCKS = ELEMENT_PRESENTATION;
const ELEMENT_SYMBOLS=Object.freeze(ELEMENT_PRESENTATION.map(item=>item.symbol));
export function availableElements(){return [...ELEMENT_SYMBOLS];}
export function nextElementUnlock(){return null;}

export function syncElementStocks(root = document, elements = {}) {
  for (const button of root.querySelectorAll('#element-palette [data-element]')) {
    const symbol=button.dataset.element,stock=button.querySelector('[data-element-stock]');
    if(!stock)continue;
    const count=Math.max(0,Number(elements[symbol]??0));
    stock.textContent=String(count);button.dataset.stockCount=String(count);
    button.disabled=button.hidden||count<=0;
    const item=ELEMENT_PRESENTATION.find(item=>item.symbol===symbol);
    if(item)button.setAttribute('aria-label',`${item.name}（${symbol}） 在庫 ${count}`);
  }
}

// Visibility scope is presentation-only. The injected access function is the
// sole gameplay authority; collection counts and fallback mode cannot unlock atoms.
export function createElementPalette(root = document, {canUse=()=>true} = {}) {
  const buttons=[...root.querySelectorAll('#element-palette [data-element]')];
  const extra=root.querySelector('#show-extra-elements'),visible=symbol=>['H','C','N','O'].includes(symbol)||!!extra?.checked;
  function render(){
    for(const button of buttons){
      const item=ELEMENT_PRESENTATION.find(item=>item.symbol===button.dataset.element);
      if(!item)continue;button.style?.setProperty?.('--element-color',item.color);
      button.hidden=!visible(item.symbol)||!canUse(item.symbol);button.disabled=button.hidden||Number(button.dataset.stockCount??0)<=0;
      button.style.order=ELEMENT_PRESENTATION.indexOf(item);
      button.title=`${item.name}（${item.symbol}）を追加`;
    }
  }
  extra?.addEventListener('change',render);
  render();
  return {
    canUse:symbol=>ELEMENT_SYMBOLS.includes(symbol)&&visible(symbol)&&canUse(symbol),
    update(){render();},
    fallback(){render();},
  };
}
