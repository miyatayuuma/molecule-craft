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

// Enhance, never replace, the static HTML palette. On DB/collection failure all
// original buttons remain usable; failure must not turn progression into a gate.
export function createElementPalette(root = document) {
  const buttons=[...root.querySelectorAll('#element-palette [data-element]')];
  const note=root.querySelector('#element-unlock-hint');
  let available=new Set(availableElements(0));
  function render(message){
    for(const button of buttons){
      const item=ELEMENT_UNLOCKS.find(item=>item.symbol===button.dataset.element);
      if(!item)continue;
      button.hidden=!available.has(item.symbol);button.disabled=button.hidden;
      button.style.order=ELEMENT_UNLOCKS.indexOf(item);
      button.title=`${item.name}（${item.symbol}）を追加`;
    }
    if(note)note.textContent=message;
  }
  render('発見3種類で N（窒素）を解放');
  return {
    canUse:symbol=>available.has(symbol),
    update(state){
      available=new Set(state.unlockedElements());
      const next=nextElementUnlock(state.discoveredCount,available);
      render(next?`次は ${next.elements.map(item=>`${item.symbol}（${item.name}）`).join('・')} · 新しい分子をあと${next.remaining}種類発見`:'すべての原子を解放済み');
    },
    fallback(){available=new Set(ELEMENT_UNLOCKS.map(item=>item.symbol));render('進行機能を利用できないため、すべての原子で自由制作できます');},
  };
}
