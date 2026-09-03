import { VEIL, EXPEDITION } from './config.js';
import { activeTankRolesFor,combustionPacketFor,performanceFor,tankCapacityFor } from './molecule-roles.js';
// Game units, not a combustion/thermodynamics simulation. Ordinary DB molecules
// need no effect entry; future shared actions can be attached here independently.
export const MOLECULE_USES = Object.freeze({
  hydrogen:{formula:'H₂',name:'水素',atoms:['H','H'],role:'burst-propellant',tankUses:['propellant'],performance:{propellant:{thrust:.82,load:.25}},hint:'Hを2つ置き、光る電子を1本つなぐ。',use:'原始的な短時間ガス噴射。通常航行には不向きだが、緊急回避と強い流れの突破に使える。',discovery:'H₂ BURSTを発見。一探索に積めるのは少量だけ。危険な瞬間まで残しておこう。'},
  methane:{formula:'CH₄',name:'メタン',atoms:['C','H','H','H','H'],role:'fuel',tankUses:['fuel'],performance:{fuel:{load:.72,oxygen:.5}},hint:'Cを中心に、4つのHをそれぞれ1本でつなぐ。',use:'高密度な燃料。単独では推進に使えず、O₂と組み合わせて初めて連続航行できる。',discovery:'メタンを発見。燃料はできた。燃焼には、さらに奥にある酸化剤が必要だ。'},
  oxygen:{formula:'O₂',name:'酸素',atoms:['O','O'],role:'oxidizer',tankUses:['oxidizer'],hint:'Oを2つ置く。同じ2原子の電子を2回つなぎ、二重結合にする。',use:'燃料ではなく酸化剤。CH₄ 1個とO₂ 2個で、押している間だけ続くCOMBUSTION DRIVEを動かす。',discovery:'酸化剤ができた。H₂の一瞬の噴射から、CH₄ + O₂による高速航行へ。'},
  water:{formula:'H₂O',name:'水',atoms:['O','H','H'],role:'catalog',hint:'Oを中心に、Hを2つそれぞれ1本でつなぐ。',use:'図鑑に記録し、通常通り量産できる分子。探索用の特殊作用は、まだ実装されていない。',discovery:'水を発見。図鑑に登録され、原子があれば量産できる。'},
});
export const TANK_USES=Object.freeze({
  propellant:{label:'噴射剤'},
  fuel:{label:'燃料'},
  oxidizer:{label:'酸化剤'},
  coolant:{label:'冷却剤'},
});
export const tankUsesFor=id=>activeTankRolesFor(id);
export const tankCapacity=(use,id)=>tankCapacityFor(use,id);
// Input chooses an action, not its physics. A later cruise controller can use
// these same actions without changing resources or adding HUD buttons.
export const DRIVES=Object.freeze({
  hydrogen:{type:'burst',label:'H₂',name:'H₂ BURST',cost:{hydrogen:40},boostSpeed:760,boostSeconds:.65,boostRadius:8,boostCooldown:.55,boostAcceleration:28,boostGrip:20},
  combustion:{type:'continuous',label:'FUEL + O₂',name:'COMBUSTION DRIVE',cost:{methane:1,oxygen:2},boostSpeed:470,packetSeconds:2,boostRadius:40,boostAcceleration:10,boostGrip:14},
});
export const GROWTH=Object.freeze({
  flight:{speed:164,driftSpeed:29,suctionRadius:30,assistRadius:78},
  dustPerAtom:{H:3,C:3,O:3},bounds:{left:-1100,right:1250,top:-12750,bottom:500},
  clusterRadius:64,clusterRespawn:40,clusterParticles:36,clusterSpread:120,clusterValue:3,
  density:{
    carbon:{spacing:25,lanes:2,value:1},
    oxygenEdge:{spacing:23,lanes:2,value:1},
    oxygenDeep:{spacing:20,lanes:4,value:2},
    frontier:{spacing:18,lanes:4,value:2},
  },
  signalChance:.38,signalPity:3,
  carbonY:-4390,oxygenY:-7830,frontierY:-11680,
});
export const REGIONS=Object.freeze({
  veil:{name:'H Veil',subtitle:'水素の帳',element:'H',x:0,y:180,angle:-Math.PI/2},
  carbon:{name:'Carbon Drift',subtitle:'炭素の群れ',element:'C',x:250,y:-4600,angle:-Math.PI/2},
  oxygen:{name:'Oxygen Surge',subtitle:'酸素の奔流',element:'O',x:170,y:-8090,angle:-Math.PI/2},
  frontier:{name:'Inner Horizon',subtitle:'まだ名のない光',element:'O',x:100,y:-11920,angle:-Math.PI/2},
});
export function regionAt(y){return y<GROWTH.frontierY?'frontier':y<GROWTH.oxygenY?'oxygen':y<GROWTH.carbonY?'carbon':'veil';}
export function flightConfig(){return {...VEIL,...GROWTH.flight,bounds:GROWTH.bounds};}
export function driveAvailable(state,id){
  if(id==='hydrogen')return state.recipes.includes('hydrogen');
  if(id==='combustion')return state.recipes.includes('oxygen')&&state.recipes.some(molecule=>performanceFor(molecule,'fuel'));
  return false;
}
const finiteFuel=value=>Number.isFinite(value)?Math.max(0,value):0;
const slot=(loadout,use,legacy)=>loadout?.[use]?.molecule?loadout[use]:{molecule:legacy,amount:finiteFuel(loadout?.[legacy])};
export function combustionPackets(loadout={}){
  const fuel=slot(loadout,'fuel','methane'),oxidizer=slot(loadout,'oxidizer','oxygen'),packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});
  if(!packet||oxidizer.molecule!=='oxygen')return 0;
  return Math.max(0,Math.min(Math.floor(finiteFuel(fuel.amount)/packet.fuelAmount),Math.floor(finiteFuel(oxidizer.amount)/packet.oxygenAmount)));
}
export function burstDriveFor(id){
  const performance=performanceFor(id,'propellant');if(!performance)return null;
  const base=DRIVES.hydrogen,power=performance.burstPower;
  return {...base,label:id,name:'BURST',boostSpeed:GROWTH.flight.speed+(base.boostSpeed-GROWTH.flight.speed)*power,boostAcceleration:base.boostAcceleration*(.55+.45*power),boostGrip:base.boostGrip*(.65+.35*power)};
}
export function propulsionGauge(id,loadout={},driveBuffer=0){
  let remaining=0,capacity=0,seconds=0,maxSeconds=0;
  if(id==='hydrogen'){
    const propellant=slot(loadout,'propellant','hydrogen'),performance=performanceFor(propellant.molecule,'propellant');
    capacity=performance?Math.floor(performance.capacity/performance.moleculesPerBurst):0;remaining=performance?Math.min(capacity,Math.floor(finiteFuel(propellant.amount)/performance.moleculesPerBurst)):0;
  }else if(id==='combustion'){
    const fuel=slot(loadout,'fuel','methane'),oxidizer=slot(loadout,'oxidizer','oxygen'),packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});
    const full={fuel:{molecule:fuel.molecule,amount:tankCapacity('fuel',fuel.molecule)??0},oxidizer:{molecule:oxidizer.molecule,amount:tankCapacity('oxidizer',oxidizer.molecule)??0}};
    capacity=packet?combustionPackets(full):0;maxSeconds=capacity*(packet?.seconds??0);
    seconds=Math.min(maxSeconds,combustionPackets(loadout)*(packet?.seconds??0)+Math.min(packet?.seconds??0,finiteFuel(driveBuffer)));
    remaining=Math.min(capacity,packet?.seconds?Math.ceil(seconds/packet.seconds):0);
  }
  const ratio=capacity?Math.max(0,Math.min(1,id==='combustion'?seconds/maxSeconds:remaining/capacity)):0;
  return {remaining,capacity,seconds,ratio,state:ratio<=0?'empty':ratio<=.34?'low':'enough'};
}
export function growthGoal(state){
  const has=id=>state.recipes.includes(id),found=state.progress.foundElements??['H'];
  if(!has('hydrogen'))return {id:'hydrogen',text:'Hを2つつなぎ、緊急用のH₂ BURSTを発見しよう。'};
  if(!found.includes('C'))return {text:'H₂は一探索に少量だけ。外縁の強い流れを抜ける瞬間に使おう。'};
  if(!has('methane'))return {id:'methane',text:'Cで作れる燃料は？ ヒントを見ても、自分の知識で組んでもいい。'};
  if(!found.includes('O'))return {text:'CH₄は燃料。酸化剤を探して、炭素の群れのさらに奥へ。'};
  if(!has('oxygen'))return {id:'oxygen',text:'O同士を二重結合に。CH₄と組み合わせる酸化剤を作ろう。'};
  if(!state.progress.frontier)return {text:'CH₄ + O₂を押している間、COMBUSTION DRIVEで高速航行できる。奥の流れへ。'};
  return {text:'さらに奥に、未知の光。今はH/C/Oを補給し、気になる分子を自由に発見できる。'};
}
