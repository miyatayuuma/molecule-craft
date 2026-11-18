import {COMPARISON_AXES} from './encyclopedia-compare.js';

export const COMPARISON_MODE_ACCESSIBLE_LABEL='分子図鑑の表示';
export const COMPARISON_MODE_LABELS=Object.freeze({graph:'樹形図',compare:'くらべる'});
const ICONS={
  graph:'ui-compare-tree',
  compare:'ui-compare-rope',
  molarMass:'ui-compare-mass',
  atomCount:'ui-compare-count',
  boilingPoint:'ui-compare-boiling',
};
const SVG_NS='http://www.w3.org/2000/svg';

export function appendComparisonIcon(button,key,label){
  const doc=button.ownerDocument;
  const icon=doc.createElementNS(SVG_NS,'svg'),use=doc.createElementNS(SVG_NS,'use');
  icon.setAttribute('class','ui-book-icon');
  icon.setAttribute('aria-hidden','true');
  icon.setAttribute('focusable','false');
  use.setAttribute('href',`#${ICONS[key]}`);
  icon.append(use);
  button.append(icon);
  button.setAttribute('aria-label',label);
  button.title=label;
}

export function createComparisonAxisControls(doc,axis,onAxis){
  const controls=doc.createElement('div');
  controls.className='compare-axis';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','比較軸');
  for(const [key,{label}] of Object.entries(COMPARISON_AXES)){
    const button=doc.createElement('button');
    button.type='button';
    button.dataset.compareAxis=key;
    button.setAttribute('aria-pressed',String(axis===key));
    appendComparisonIcon(button,key,label);
    button.addEventListener('click',()=>{if(key!==axis)onAxis(key);});
    controls.append(button);
  }
  return controls;
}

export function comparisonModelUrl(id){
  return new URL(`../assets/models/molecule-${id}.svg`,import.meta.url).href;
}

export function createComparisonObservation(stage,axis){
  if(axis!=='molarMass'&&axis!=='atomCount')return null;
  const doc=stage.ownerDocument,layer=doc.createElement('div');
  layer.className='compare-observation';
  layer.setAttribute('aria-hidden','true');
  stage.prepend(layer);

  // Replace synchronously at selection boundaries. Unknown beads never build
  // a model URL or retain the previous bead's model during a transition.
  return row=>{
    if(!row){layer.replaceChildren();return;}
    const bead=doc.createElement('div');
    bead.className=`compare-observation-bead ${row.discovered?'registered':'unknown'}`;
    if(row.discovered){
      const model=doc.createElement('img');
      model.src=comparisonModelUrl(row.id);
      model.alt='';
      model.decoding='async';
      model.addEventListener('error',()=>model.remove(),{once:true});
      bead.append(model);
    }else{
      const symbol=doc.createElement('span');
      symbol.textContent='?';
      bead.append(symbol);
    }
    layer.replaceChildren(bead);
  };
}
