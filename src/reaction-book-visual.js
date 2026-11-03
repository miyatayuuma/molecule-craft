import {polymerReactionImage} from './reaction-polymer-thumbnail.js';
import {GROUP_GRAPHICS} from './reaction-group-schematics.js';
// Static reaction-book preview motifs. Chemistry and unlock status remain owned by the catalog/progress.
export const GROUP_PREVIEW_SPECS=Object.freeze({
  hydrolysis:{renderer:'svg',motion:'split',durationMs:5600,caption:'水が加わり結合が切れる'},
  esterification:{renderer:'svg',motion:'join-ester',durationMs:5600,caption:'酸とアルコール由来の部分がエステル結合でつながる'},
  addition:{renderer:'svg',motion:'attach',durationMs:5600,caption:'結合への付加'},
  halogenation:{renderer:'svg',motion:'halogen',durationMs:5600,caption:'ハロゲンが分子に取り込まれる例'},
  'ring-opening':{renderer:'svg',motion:'open-ring',durationMs:5600,caption:'環が開いて鎖につながる'},
  hydration:{renderer:'svg',motion:'add-water',durationMs:5600,caption:'水由来のHとOHが加わる例'},
  substitution:{renderer:'svg',motion:'swap',durationMs:5600,caption:'分子内の原子や原子団が置き換わる'},
  cycloaddition:{renderer:'svg',motion:'close-ring',durationMs:5600,caption:'環ができる'},
  oxidation:{renderer:'svg',motion:'oxygen',durationMs:5600,caption:'酸化による酸素を含む結合の変化の例'},
  dehydration:{renderer:'svg',motion:'release-water',durationMs:5600,caption:'脱水で水が離れる反応の例'},
  condensation:{renderer:'svg',motion:'join-condense',durationMs:5600,caption:'分子が結びつき、小分子が離れる'},
  combustion:{renderer:'svg',motion:'release-energy',durationMs:5600,caption:'燃焼で酸素と反応し、熱が放出される'},
  polymerization:{renderer:'svg',motion:'grow-chain',durationMs:5600,caption:'繰返し単位がつながる'}
  ,other:{renderer:'svg',motion:'gallery',durationMs:5600,caption:'その他の反応に共通する単一機構はない'}
});
export const REACTION_THUMBNAIL_SPECS=Object.freeze({
  'normal:complete-01-anhydride-hydrolysis':{kind:'normal',pattern:'cleavage',before:'CH3CO–O–COCH3 + H2O',after:'2 CH3COOH',feature:'酸無水物の結合が切れ、酢酸が2分子できる'},
  'normal:complete-06-ethene-halogenation':{kind:'normal',pattern:'halogen',before:'CH2=CH2 + Cl2',after:'ClCH2–CH2Cl',feature:'二重結合が単結合になり、2個のClが加わる'},
  'normal:complete-21-cyclobutane-dimerization':{kind:'normal',pattern:'ring',before:'2 CH2=CH2',after:'C4H8（四員環）',feature:'2分子のエチレンから炭素4個の四員環ができる'},
  'polymer:polyethylene-coordination':{kind:'polymer',pattern:'polyethylene',before:'n CH2=CH2',after:'[–CH2–CH2–]n',feature:'エチレン由来の炭素鎖が反復する'},
  'polymer:polyethylene-terephthalate-direct-polycondensation':{kind:'polymer',pattern:'pet',before:'HO–CH2CH2–OH + HOOC–C6H4–COOH',after:'[–O–CH2CH2–O–CO–C6H4–CO–]n',feature:'芳香環とエステル結合を持つ反復単位。縮合時に水が離れる'}
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
  svg.setAttribute('viewBox',kind==='group'?'40 -18 160 114':'0 0 240 78');
  if(kind==='group')svg.setAttribute('preserveAspectRatio','xMidYMid meet');
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

// Every listed thumbnail is derived from its catalog entry; the five hand-drawn
// examples above remain illustrative overrides, not a competing reaction database.
const CHANGE_EXPLANATIONS=Object.freeze({
  hydrolysis:'水が関わり、結合が切れて生成物が分かれる。',
  esterification:'酸とアルコールなどに由来する部分がエステル結合でつながる。',
  addition:'もとの多重結合などが変わり、原子や原子団が新たに結びつく。',
  halogenation:'塩素などのハロゲンが化合物に取り込まれる。',
  'ring-opening':'環の結合が開き、新しい結合配置になる。',
  hydration:'水に由来する成分が加わり、新しい結合ができる。',
  substitution:'ある原子・原子団が別の原子・原子団に置き換わる。',
  cycloaddition:'複数の反応物から新しい環状構造ができる。',
  oxidation:'電子の授受や酸素との結合の変化によって酸化が起こる。',
  dehydration:'反応で水が離れ、残った部分の結合が変わる。',
  condensation:'分子が新しく結合し、小分子が生じる。',
  combustion:'酸素との反応で化学エネルギーが熱などとして放出される。',
  other:'材料と生成物の違いを比べ、反応ごとの結合の変化を見つけよう。'
});
const POLYMER_CHANGE=Object.freeze({
  vinyl:'炭素の二重結合をもつ分子から、繰返しの炭素鎖が成長する。',
  diene:'ジエンに由来する結合が変化して鎖が伸び、一部の二重結合が残る。',
  epoxide:'小さな環が開き、酸素を含む長い鎖につながる。',
  'ester-condensation':'モノマーがエステル結合でつながり、縮合の際に水が生じる。',
  'amide-condensation':'モノマーがアミド結合でつながり、縮合の際に水が生じる。',
  'phenol-methylene-bridge':'フェノール環同士がメチレン橋で結びつき、網目状の構造へ成長する。'
});
function modelAsset(id,type){
  if(typeof id!=='string'||!/^[a-z0-9-]+$/.test(id))return null;
  return `assets/models/${type}-${id}.svg`;
}
export function reactionThumbnailModel(entry,{records=[],polymerRecords=[]}={}){
  if(!entry?.reactionId||!entry.definition)return null;
  const moleculeName=id=>records.find(x=>x.id===id)?.commonNameJa??records.find(x=>x.id===id)?.nameJa??id;
  const polymerName=id=>polymerRecords.find(x=>x.id===id)?.nameJa??id;
  const d=entry.definition,polymer=entry.kind==='polymer';
  const inputs=polymer?d.feedSpecies:d.reactants.map(x=>x.species);
  const outputs=polymer?[d.polymerId]:d.products;
  if(!Array.isArray(inputs)||!inputs.length||!Array.isArray(outputs)||!outputs.length)return null;
  const families=d.transformFamilies??[];
  const tag=entry.categoryTags.find(x=>CHANGE_EXPLANATIONS[x])??'other';
  const feature=REACTION_THUMBNAIL_SPECS[entry.reactionId]?.feature??(polymer?(POLYMER_CHANGE[families.find(x=>POLYMER_CHANGE[x])]??'繰返し単位の結合が増え、高分子を形成する。'):CHANGE_EXPLANATIONS[tag]);
  return Object.freeze({
    id:entry.reactionId,kind:entry.kind,feature,
    inputs:inputs.map(id=>({id,name:moleculeName(id),src:modelAsset(id,'molecule')})),
    outputs:[...outputs.map(id=>({id,name:polymer?polymerName(id):moleculeName(id),src:polymer?null:modelAsset(id,'molecule'),polymerUnit:polymer})),...(polymer&&families.some(f=>['ester-condensation','amide-condensation','phenol-methylene-bridge'].includes(f))?[{id:'water',name:moleculeName('water'),src:modelAsset('water','molecule'),polymerUnit:false}]:[])],
    before:inputs.map(moleculeName).join(' ＋ '),after:outputs.map(id=>polymer?polymerName(id):moleculeName(id)).join(' ＋ ')
  });
}

export function createReactionThumbnailFromEntry(entry,context={}){
  const spec=reactionThumbnailModel(entry,context);
  if(!spec)return null;
  // All 54 reactions use the same model-based presentation.
  const box=document.createElement('span');
  box.className='rb-reaction-thumb rb-reaction-thumb-models';
  box.dataset.previewReaction=entry.reactionId;
  const images=document.createElement('span');images.className='rb-reaction-assets';
  const asset=(data)=>{
    const img=data.polymerUnit?polymerReactionImage(data.id,data.name):document.createElement('img');if(data.src)img.src=data.src;img.alt=data.name;
    img.loading='lazy';img.decoding='async';img.draggable=false;return img;
  };
  const arrow=document.createElement('span');arrow.className='rb-arrow';arrow.textContent='→';
  const side=list=>{const group=document.createElement('span');group.className='rb-reaction-side';list.forEach((item,index)=>{if(index){const plus=document.createElement('span');plus.className='rb-plus';plus.textContent='＋';group.append(plus);}group.append(asset(item));});return group;};
  images.append(side(spec.inputs),arrow,side(spec.outputs));
  box.append(images);
  return box;
}

export function createReactionDetailModels(entry,context={}){
  const spec=reactionThumbnailModel(entry,context);
  if(!spec)return null;
  const box=document.createElement('div');box.className='rb-reaction-detail';
  const areas=document.createElement('div');areas.className='rb-detail-molecules';
  for(const [heading,list] of [['反応前の分子',spec.inputs],['反応後の分子・高分子',spec.outputs]]){
    const column=document.createElement('section'),title=document.createElement('h4');title.textContent=heading;column.append(title);
    for(const item of list){
      const tile=document.createElement('div');tile.className='rb-molecule-tile';
      const img=item.polymerUnit?polymerReactionImage(item.id,item.name):document.createElement('img');if(item.src)img.src=item.src;img.alt=item.name;img.loading='lazy';img.decoding='async';
      const name=document.createElement('span');name.textContent=item.name;
      tile.append(img,name);column.append(tile);
    }
    areas.append(column);
  }
  const description=document.createElement('p');description.textContent=spec.feature;
  box.append(areas,description);return box;
}
