import { VEIL } from './config.js';
// Game units, not a combustion/thermodynamics simulation. Ordinary DB molecules
// need no effect entry; future shared actions can be attached here independently.
export const MOLECULE_USES = Object.freeze({
  hydrogen:{formula:'H₂',name:'水素',atoms:['H','H'],role:'propellant',hint:'Hを2つ置き、光る電子を1本つなぐ。',use:'水素推進。通常の吸引幅と巡航速度が上がる。1個で短いブースト。',discovery:'水素推進が始動。吸引幅と巡航速度が上がった。H₂を保管して空白の先へ。'},
  methane:{formula:'CH₄',name:'メタン',atoms:['C','H','H','H','H'],role:'fuel',hint:'Cを中心に、4つのHをそれぞれ1本でつなぐ。',use:'小さな分子に燃料を蓄える。単独では燃焼しない。O₂があれば長い高出力推進に使える。',discovery:'メタンを発見。燃料はできた。燃焼には、さらに奥にある酸化剤が必要だ。'},
  oxygen:{formula:'O₂',name:'酸素',atoms:['O','O'],role:'oxidizer',hint:'Oを2つ置く。同じ2原子の電子を2回つなぎ、二重結合にする。',use:'燃料ではなく酸化剤。CH₄ 1個とO₂ 2個を消費して、長い高出力推進。',discovery:'酸化剤ができた。CH₄とO₂を保管すると、燃焼推進で強い逆流に挑める。'},
  water:{formula:'H₂O',name:'水',atoms:['O','H','H'],role:'coolant',hint:'Oを中心に、Hを2つそれぞれ1本でつなぐ。',use:'熱が上がると1個ずつ自動で冷却。温度を下げ、短時間の冷却を持続する。',discovery:'冷却材ができた。H₂Oを保管すると熱に応じて自動冷却。高温帯で試そう。'},
});
// Input chooses an action, not its physics. A later cruise controller can use
// these same actions without changing resources or adding HUD buttons.
export const DRIVES=Object.freeze({
  hydrogen:{label:'H₂',name:'水素推進',cost:{hydrogen:1},boostSpeed:670,boostSeconds:1.35,boostRadius:90,boostCooldown:.25},
  combustion:{label:'CH₄ + O₂',name:'燃焼推進',cost:{methane:1,oxygen:2},boostSpeed:960,boostSeconds:3.2,boostRadius:112,boostCooldown:.3},
});
export const GROWTH=Object.freeze({
  starter:{speed:138,driftSpeed:25,suctionRadius:17,chainRadiusBonus:3,assistRadius:65},
  hydrogen:{speed:208,driftSpeed:34,suctionRadius:62,chainRadiusBonus:22,assistRadius:95},
  dustPerAtom:{H:3,C:3,O:3},bounds:{left:-1100,right:1250,top:-12750,bottom:500},
  clusterRadius:62,clusterRespawn:42,clusterParticles:30,clusterSpread:116,
  signalChance:.38,signalPity:3,cooling:{threshold:42,drop:24,seconds:4,rate:17},
  heat:{ambientLoss:13,max:100,derateStart:78,minimumThrust:.16,recover:48},
  carbonY:-4390,oxygenY:-7830,frontierY:-11680,
});
export const REGIONS=Object.freeze({
  veil:{name:'H Veil',subtitle:'水素の帳',element:'H',x:0,y:180,angle:-Math.PI/2},
  carbon:{name:'Carbon Drift',subtitle:'炭素の群れ',element:'C',x:250,y:-4600,angle:-Math.PI/2},
  oxygen:{name:'Oxygen Surge',subtitle:'酸素の奔流',element:'O',x:170,y:-8090,angle:-Math.PI/2},
  frontier:{name:'Inner Horizon',subtitle:'まだ名のない光',element:'O',x:100,y:-11920,angle:-Math.PI/2},
});
export function regionAt(y){return y<GROWTH.frontierY?'frontier':y<GROWTH.oxygenY?'oxygen':y<GROWTH.carbonY?'carbon':'veil';}
export function flightConfig(state){return {...VEIL,...(state.recipes.includes('hydrogen')?GROWTH.hydrogen:GROWTH.starter),bounds:GROWTH.bounds};}
export function driveAvailable(state,id){const drive=DRIVES[id];return !!drive&&Object.keys(drive.cost).every(key=>state.recipes.includes(key));}
export function growthGoal(state){
  const has=id=>state.recipes.includes(id),found=state.progress.foundElements??['H'];
  if(!has('hydrogen'))return {id:'hydrogen',text:'Hを2つつないで、最初の推進分子を発見しよう。'};
  if(!found.includes('C'))return {text:'H₂で空白をつなぐ。外縁の流れを抜けると、違う塵がある。'};
  if(!has('methane'))return {id:'methane',text:'Cで作れる燃料は？ ヒントを見ても、自分の知識で組んでもいい。'};
  if(!found.includes('O'))return {text:'CH₄は燃料。酸化剤を探して、炭素の群れのさらに奥へ。'};
  if(!has('oxygen'))return {id:'oxygen',text:'O同士を二重結合に。CH₄と組み合わせる酸化剤を作ろう。'};
  if(!has('water'))return {id:'water',text:'高温帯では推力が落ちる。HとOから冷却材を作ろう。'};
  if(!state.progress.frontier)return {text:'燃焼推進と自動冷却を補給して、高温の逆流帯を越えよう。'};
  return {text:'さらに奥に、未知の光。今はH/C/Oを補給し、気になる分子を自由に発見できる。'};
}
