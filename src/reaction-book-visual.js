// Static reaction-book preview motifs. Chemistry and unlock status remain owned by the catalog/progress.
export const GROUP_PREVIEW_SPECS=Object.freeze({
  hydrolysis:{renderer:'svg',motion:'split',durationMs:2400,caption:'水が加わり結合が切れる'},
  addition:{renderer:'svg',motion:'attach',durationMs:2500,caption:'結合への付加'},
  cycloaddition:{renderer:'svg',motion:'close-ring',durationMs:2600,caption:'環ができる'},
  polymerization:{renderer:'svg',motion:'grow-chain',durationMs:2700,caption:'繰返し単位がつながる'}
});
export const REACTION_THUMBNAIL_SPECS=Object.freeze({
  'normal:complete-01-anhydride-hydrolysis':{kind:'normal',pattern:'cleavage',before:'CH3CO–O–COCH3 + H2O',after:'2 CH3COOH',feature:'酸無水物の結合が切れ、酢酸が2分子できる'},
  'normal:complete-06-ethene-halogenation':{kind:'normal',pattern:'halogen',before:'CH2=CH2 + Cl2',after:'ClCH2–CH2Cl',feature:'二重結合が単結合になり、2個のClが加わる'},
  'normal:complete-21-cyclobutane-dimerization':{kind:'normal',pattern:'ring',before:'2 CH2=CH2',after:'C4H8（四員環）',feature:'2分子のエチレンから炭素4個の四員環ができる'},
  'polymer:polyethylene-coordination':{kind:'polymer',pattern:'polyethylene',before:'n CH2=CH2',after:'[–CH2–CH2–]n',feature:'エチレン由来の炭素鎖が反復する'},
  'polymer:polyethylene-terephthalate-direct-polycondensation':{kind:'polymer',pattern:'pet',before:'HO–CH2CH2–OH + HOOC–C6H4–COOH',after:'[–O–CH2CH2–O–CO–C6H4–CO–]n',feature:'芳香環とエステル結合を持つ反復単位。縮合時に水が離れる'}
});

const GROUP_GRAPHICS=Object.freeze({
  hydrolysis:'<g class="rb-water"><text x="115" y="17" text-anchor="middle" fill="#86c9f8" font-size="15" font-weight="700">H₂O</text></g><g class="rb-split-left"><circle cx="93" cy="45" r="14" fill="#8095a5"/><text x="93" y="50" text-anchor="middle" fill="#fff" font-size="14">A</text></g><g class="rb-split-right"><circle cx="138" cy="45" r="14" fill="#8095a5"/><text x="138" y="50" text-anchor="middle" fill="#fff" font-size="14">B</text></g><path class="rb-broken" d="M108 45H123" stroke="#dfe9f2" stroke-width="5" stroke-linecap="round"/>',
  addition:'<g><circle cx="90" cy="39" r="13" fill="#8195a6"/><circle cx="139" cy="39" r="13" fill="#8195a6"/><text x="90" y="44" text-anchor="middle" fill="#fff" font-size="13">C</text><text x="139" y="44" text-anchor="middle" fill="#fff" font-size="13">C</text></g><path d="M104 34H125" stroke="#dce5ef" stroke-width="3"/><path class="rb-double" d="M104 43H125" stroke="#dce5ef" stroke-width="3"/><g class="rb-attach-left"><circle cx="54" cy="39" r="12" fill="#50ac70"/><text x="54" y="44" fill="#fff" text-anchor="middle" font-size="12">X</text><path d="M66 39H76" stroke="#bfded1" stroke-width="3"/></g><g class="rb-attach-right"><circle cx="176" cy="39" r="12" fill="#50ac70"/><text x="176" y="44" fill="#fff" text-anchor="middle" font-size="12">Y</text><path d="M151 39H164" stroke="#bfded1" stroke-width="3"/></g>',
  cycloaddition:'<g class="rb-alkenes" stroke="#dce5ef" stroke-width="3" stroke-linecap="round"><path d="M80 31H115M80 38H115M130 31H165M130 38H165"/></g><g class="rb-square"><rect x="96" y="15" width="48" height="48" rx="2" fill="none" stroke="#86ddad" stroke-width="5"/><circle cx="96" cy="15" r="6" fill="#889aab"/><circle cx="144" cy="15" r="6" fill="#889aab"/><circle cx="96" cy="63" r="6" fill="#889aab"/><circle cx="144" cy="63" r="6" fill="#889aab"/></g>',
  polymerization:'<g fill="#92a8b7" stroke="#d5e5ef" stroke-width="4"><path d="M49 40H187"/><circle cx="55" cy="40" r="13" stroke="none"/><circle cx="95" cy="40" r="13" stroke="none"/><circle class="rb-chain-3" cx="135" cy="40" r="13" stroke="none"/><circle class="rb-chain-4" cx="175" cy="40" r="13" stroke="none"/></g><g fill="#fff" text-anchor="middle" font-size="13" font-weight="700"><text x="55" y="45">C</text><text x="95" y="45">C</text><text class="rb-chain-3" x="135" y="45">C</text><text class="rb-chain-4" x="175" y="45">C</text></g><text x="207" y="45" fill="#f1ca7b" font-size="16">…</text>'
});
const THUMB_GRAPHICS=Object.freeze({
  cleavage:'<g stroke="#dfe9f2" stroke-width="4" stroke-linecap="round"><path d="M35 37H85M94 37H145"/><path d="M92 31L88 43" stroke="#f9c764"/></g><circle cx="85" cy="37" r="10" fill="#ee6468"/><circle cx="145" cy="37" r="9" fill="#8e9cab"/><text x="85" y="41" fill="#fff" font-size="11" text-anchor="middle">O</text><text x="36" y="22" fill="#f5d385" font-size="12">H₂O</text><path d="M175 21V53" stroke="#8fb0c4" stroke-width="2" stroke-dasharray="3 4"/><g fill="#ee6468"><circle cx="199" cy="36" r="9"/><circle cx="222" cy="36" r="9"/></g>',
  halogen:'<path d="M52 33H100M52 41H100" stroke="#dce7ef" stroke-width="4"/><g fill="#9faeba"><circle cx="51" cy="37" r="11"/><circle cx="101" cy="37" r="11"/></g><path d="M130 37H178" stroke="#dce7ef" stroke-width="4"/><g fill="#9faeba"><circle cx="130" cy="37" r="11"/><circle cx="178" cy="37" r="11"/></g><g fill="#51bd77"><circle cx="130" cy="15" r="11"/><circle cx="178" cy="59" r="11"/></g><path d="M130 26V30M178 48V43" stroke="#a6e5bc" stroke-width="3"/>',
  ring:'<g stroke="#dce7ef" stroke-width="3"><path d="M39 23H78M39 30H78M39 49H78M39 56H78"/></g><g fill="#a2b2bf"><circle cx="39" cy="26" r="7"/><circle cx="78" cy="26" r="7"/><circle cx="39" cy="53" r="7"/><circle cx="78" cy="53" r="7"/></g><rect x="137" y="15" width="49" height="49" rx="2" fill="none" stroke="#8ed8aa" stroke-width="4"/><g fill="#a2b2bf"><circle cx="137" cy="15" r="7"/><circle cx="186" cy="15" r="7"/><circle cx="137" cy="64" r="7"/><circle cx="186" cy="64" r="7"/></g>',
  polyethylene:'<g stroke="#dce7ef" stroke-width="4"><path d="M30 38H212"/></g><g fill="#97aabb"><circle cx="44" cy="38" r="12"/><circle cx="85" cy="38" r="12"/><circle cx="126" cy="38" r="12"/><circle cx="167" cy="38" r="12"/><circle cx="207" cy="38" r="12"/></g><g fill="#f7fbff" text-anchor="middle" font-size="12"><text x="44" y="42">C</text><text x="85" y="42">C</text><text x="126" y="42">C</text><text x="167" y="42">C</text><text x="207" y="42">C</text></g><text x="14" y="44" fill="#f1ce75" font-size="24">[</text><text x="225" y="44" fill="#f1ce75" font-size="24">]</text>',
  // Terephthalate diester segment: –O–C(=O)–C6H4–C(=O)–O– (the formula beneath includes the ethylene glycol segment).
  pet:'<path d="M91 30L117 15L143 30V58L117 73L91 58Z" fill="none" stroke="#dce7ef" stroke-width="3"/><path d="M96 34L117 22M137 34V54M117 66L97 54" stroke="#bdd1de" stroke-width="2"/><path d="M29 44H51M69 44H91M143 44H165M183 44H209" stroke="#e1edf2" stroke-width="3"/><path d="M57 32V24M63 32V24M171 32V24M177 32V24" stroke="#e1edf2" stroke-width="2"/><g fill="#ef6669"><circle cx="20" cy="44" r="9"/><circle cx="60" cy="13" r="9"/><circle cx="174" cy="13" r="9"/><circle cx="218" cy="44" r="9"/></g><g fill="#9aabba"><circle cx="60" cy="44" r="9"/><circle cx="174" cy="44" r="9"/></g><g fill="#fff" font-size="10" text-anchor="middle"><text x="20" y="48">O</text><text x="60" y="17">O</text><text x="174" y="17">O</text><text x="218" y="48">O</text><text x="60" y="48">C</text><text x="174" y="48">C</text></g>'
});

const NS='http://www.w3.org/2000/svg';
let observer;
function watchVisibility(node){
  if(typeof IntersectionObserver==='undefined'){node.classList.add('rb-visible');return;}
  if(!observer)observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.target.isConnected){observer.unobserve(entry.target);continue;}
      entry.target.classList.toggle('rb-visible',entry.isIntersecting);
    }
  },{threshold:0.05});
  observer.observe(node);
}
function vector(markup,label,kind){
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox',kind==='group'?'0 0 240 78':'0 0 240 78');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label',label);
  svg.setAttribute('focusable','false');
  svg.innerHTML=markup; // only module-owned fixed SVG constants; no catalog/user content is interpolated
  return svg;
}
export function createReactionGroupPreview(id){
  const spec=GROUP_PREVIEW_SPECS[id];
  if(!spec)return null;
  const box=document.createElement('span');
  box.className='rb-group-preview rb-motion-'+id;
  box.dataset.previewGroup=id;
  box.append(vector(GROUP_GRAPHICS[id],spec.caption,'group'));
  watchVisibility(box);
  return box;
}
export function createReactionThumbnail(id){
  const spec=REACTION_THUMBNAIL_SPECS[id];
  if(!spec)return null;
  const box=document.createElement('span');
  box.className='rb-reaction-thumb rb-thumb-'+spec.pattern;
  box.dataset.previewReaction=id;
  const pic=vector(THUMB_GRAPHICS[spec.pattern],spec.feature,'reaction');
  const legend=document.createElement('span');legend.className='rb-thumb-legend';
  const before=document.createElement('span');before.textContent='前：'+spec.before;
  const after=document.createElement('span');after.textContent='後：'+spec.after;
  legend.append(before,after);
  box.append(pic,legend);
  return box;
}
