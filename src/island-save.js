import {createIslandState, clamp} from './island-engine.js?v=33';
import {SAMPLE_BY_ID, DISCOVERY_BY_ID, ISLAND_SPECIES, TARGET_BY_ID} from './island-data.js?v=33';

export const ISLAND_STORAGE_KEY='molecule-craft.discovery-island.v1';
const clone=value=>JSON.parse(JSON.stringify(value));
export function islandSnapshot(world) {
  const copy=clone(world);copy.events=[];copy.nextEvent=0;return copy;
}
export function validateIslandSave(value) {
  if (!value||value.schemaVersion!==1||!value.zones||!value.preferences) throw new Error('Unsupported island');
  const clean=createIslandState();
  // Copy only known fields and finite bounded numbers; never merge arbitrary keys.
  for (const id of Object.keys(clean.zones)) {
    if(!value.zones[id])throw new Error('Missing island zone');
    for(const [key,fallback]of Object.entries(clean.zones[id])) {
      const n=value.zones[id][key];
      if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Invalid island number');
      clean.zones[id][key]=clamp(n,0,key==='pH'?14:key==='fuel'?6:4);
    }
  }
  for(const key of ['clock','experiments','power','caveLight','waterfall']) {
    if(!Number.isFinite(value[key])||value[key]<0)throw new Error('Invalid island state');
    clean[key]=Math.min(value[key],key==='clock'||key==='experiments'?1e9:4);
  }
  for(const field of ['garden','burner','lens','unlocks','flags']) {
    if(!value[field]||typeof value[field]!=='object')throw new Error('Missing island state');
    for(const [key,base]of Object.entries(clean[field])) {
      if(typeof base==='boolean')clean[field][key]=value[field][key]===true;
      else {if(!Number.isFinite(value[field][key]))throw new Error('Invalid island state');clean[field][key]=clamp(value[field][key],0,2);}
    }
  }
  if(!Array.isArray(value.samples)||!Array.isArray(value.discoveries)||!Array.isArray(value.encounters)||!Array.isArray(value.pending))throw new Error('Invalid island journal');
  clean.samples=[...new Set(value.samples.filter(id=>SAMPLE_BY_ID.has(id)))];
  const species=new Set(ISLAND_SPECIES.map(s=>s.id));
  const entries=(items,valid)=>[...new Map(items.filter(d=>d&&valid.has(d.id)&&Number.isFinite(d.at)&&d.at>=0&&TARGET_BY_ID.has(d.target)).map(d=>[d.id,{id:d.id,at:d.at,target:d.target}])).values()];
  clean.discoveries=entries(value.discoveries,DISCOVERY_BY_ID);clean.encounters=entries(value.encounters,species);
  clean.pending=value.pending.filter(d=>d&&['phenomenon','creature'].includes(d.kind)&&(d.kind==='creature'?species:DISCOVERY_BY_ID).has(d.id)&&TARGET_BY_ID.has(d.target)&&Number.isFinite(d.at)&&d.at>=0).slice(0,40).map(d=>({id:d.id,kind:d.kind,target:d.target,at:Math.min(d.at,clean.clock+2)}));
  if(!Array.isArray(value.creatures)||value.creatures.length!==clean.creatures.length)throw new Error('Invalid island creatures');
  for (const c of clean.creatures) {
    const saved=value.creatures.find(v=>v?.id===c.id);
    if(!saved||!Number.isFinite(saved.x)||!Number.isFinite(saved.z))throw new Error('Invalid creature position');
    c.x=clamp(saved.x,-5,5);c.z=clamp(saved.z,-3.5,3.5);
    c.behavior=['rest','flee','swim','graze','glow'].includes(saved.behavior)?saved.behavior:'rest';c.active=saved.active===true;
  }
  clean.preferences={muted:value.preferences.muted===true,scene:value.preferences.scene==='craft'?'craft':'island',selected:clean.samples.includes(value.preferences.selected)?value.preferences.selected:null,dose:value.preferences.dose===3?3:1};
  return clean;
}
export function createIslandStorage({storage,onStatus=()=>{}}={}) {
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  let previous=null,blocked='',message='';
  const status=text=>{if(message!==text){message=text;onStatus(text);}};
  return {
    read() {
      try {
        if(!storage){status('島はこの画面の間だけ保存されます。');return createIslandState();}
        previous=storage.getItem(ISLAND_STORAGE_KEY);
        if(previous===null)return createIslandState();
        if(previous.length>300000)throw new Error('Save too large');
        const raw=JSON.parse(previous);
        if(Number(raw?.schemaVersion)>1){blocked='future';status('新しい版の島を保護しています。更新すると続けられます。');return createIslandState();}
        return validateIslandSave(raw);
      } catch {blocked='invalid';status('島を復元できませんでした。元の保存は保護しています。メニューから島だけやり直せます。');return createIslandState();}
    },
    write(world) {
      if(blocked)return false;
      try {
        if(!storage){status('島はこの画面の間だけ保存されます。');return false;}
        if(storage.getItem(ISLAND_STORAGE_KEY)!==previous){blocked='conflict';status('別の画面で島が変わりました。上書きを止めています。再読み込みしてください。');return false;}
        const raw=JSON.stringify(islandSnapshot(world));
        validateIslandSave(JSON.parse(raw));
        if(raw!==previous){storage.setItem(ISLAND_STORAGE_KEY,raw);previous=raw;}status('');return true;
      } catch {status('島を保存できません。端末の空き容量や保存設定を確認してください。');return false;}
    },
    allowReset(){if(blocked==='invalid'){blocked='';status('');}return !blocked;},
    get message(){return message;},get protected(){return !!blocked;},
  };
}
