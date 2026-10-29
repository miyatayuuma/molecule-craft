import {connectPhenolicReference} from './phenolic-reference-transition.js?v=2';
import {connectCopolymerReference} from './copolymer-reference-transition.js?v=1';
import {connectPetReference} from './pet-reference-transition.js?v=1';
import {connectCondensationDieneReference} from './condensation-diene-reference-transition.js?v=1';
import {connectVinylPolymerReference} from './vinyl-polymer-reference-transition.js?v=1';
import {connectBranchedPolymerReference} from './branched-polymer-reference-transition.js?v=1';
import {connectPolyethyleneReference} from './polyethylene-reference-transition.js?v=1';

// Adapters may only publish a display plan after proving that the complete
// finite graph is embedded unchanged. An unsupported topology fails closed.
const adapters=Object.freeze({'phenol-formaldehyde-resin':connectPhenolicReference,...Object.fromEntries(['ethylene-propylene-copolymer','styrene-butadiene-copolymer','nitrile-butadiene-rubber','butyl-rubber','vinylidene-fluoride-hexafluoropropylene-copolymer'].map(id=>[id,connectCopolymerReference])),...Object.fromEntries(['polyethylene-terephthalate','polyethylene-adipate','polyethylene-adipamide','nylon-6-6'].map(id=>[id,connectPetReference])),...Object.fromEntries(['polyethylene-oxide','polybutadiene','polyisoprene','polylactic-acid','polyglycolic-acid'].map(id=>[id,connectCondensationDieneReference])),polyethylene:connectPolyethyleneReference,polypropylene:connectBranchedPolymerReference,polyisobutylene:connectBranchedPolymerReference,...Object.fromEntries(['polystyrene','polyvinyl-chloride','polychlorotrifluoroethylene','polyacrylonitrile','polyacrylic-acid','polyvinylidene-fluoride','polytetrafluoroethylene'].map(id=>[id,connectVinylPolymerReference]))});
const valence=Object.freeze({H:1,C:4,N:3,O:2,F:1,Cl:1});
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
function inspectGraph(graph){
  if(!Array.isArray(graph?.atoms)||!graph.atoms.length||!Array.isArray(graph.bonds))throw Error('reference-transition-invalid-graph');
  const degrees=graph.atoms.map(()=>0),adj=graph.atoms.map(()=>[]),edges=new Map();
  for(const atom of graph.atoms){
    if(!(atom.element in valence)||![atom.x,atom.y,atom.z].every(Number.isFinite))throw Error('reference-transition-invalid-atom');
  }
  for(const bond of graph.bonds){
    const {a,b,order}=bond,key=edgeKey(a,b);
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=degrees.length||b>=degrees.length||a===b||![1,2,3].includes(order)||edges.has(key))throw Error('reference-transition-invalid-bond');
    edges.set(key,order);degrees[a]+=order;degrees[b]+=order;adj[a].push(b);adj[b].push(a);
  }
  if(graph.atoms.some((atom,i)=>degrees[i]>valence[atom.element]))throw Error('reference-transition-invalid-valence');
  const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adj[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}
  if(seen.size!==graph.atoms.length)throw Error('reference-transition-disconnected');
  return edges;
}
export function connectPolymerReference(THREE,finite,reference,units){
  const adapter=adapters[reference?.polymerId];
  if(!adapter)throw Error('reference-transition-unsupported');
  const finiteEdges=inspectGraph(finite);
  const result=adapter(THREE,finite,reference,units),{plan,matched,bridge}=result;
  const planEdges=inspectGraph(plan),mapping=new Map(),used=new Set(),removed=new Set(result.removedFinite??[]);
  for(const pair of matched??[]){
    const f=pair.finite,r=pair.reference,a=finite.atoms[f],b=plan.atoms[r];
    if(!Number.isInteger(f)||!Number.isInteger(r)||!a||!b||mapping.has(f)||used.has(r)||a.element!==b.element||a.x!==b.x||a.y!==b.y||a.z!==b.z)throw Error('reference-transition-invalid-mapping');
    mapping.set(f,r);used.add(r);
  }
  const alternating=['polyethylene-terephthalate','polyethylene-adipate','polyethylene-adipamide','nylon-6-6'].includes(reference.polymerId);
  if(removed.size&&!alternating&&(!['polylactic-acid','polyglycolic-acid','phenol-formaldehyde-resin'].includes(reference.polymerId)||removed.size!==2||[...removed].some(i=>!finite.atoms[i])||[...removed].map(i=>finite.atoms[i].element).sort().join(',')!=='H,O'))throw Error('reference-transition-invalid-condensation');
  if(reference.polymerId==='phenol-formaldehyde-resin'){const o=[...removed].find(i=>finite.atoms[i]?.element==='O'),h=[...removed].find(i=>finite.atoms[i]?.element==='H'),source=[...mapping].find(([,r])=>r===bridge?.a)?.[0];if(removed.size!==2||!Number.isInteger(o)||!Number.isInteger(h)||finiteEdges.get(edgeKey(o,h))!==1||finiteEdges.get(edgeKey(o,source))!==1||result.water?.finite?.join(',')!==[o,h].join(',')||result.water?.incoming?.length!==1)throw Error('reference-transition-invalid-condensation');}
  if(alternating&&(removed.size!==1||finite.atoms[[...removed][0]]?.element!=='H'||!finite.bonds.some(b=>((b.a===[...removed][0]&&b.b===reverseIndex(bridge?.a))||(b.b===[...removed][0]&&b.a===reverseIndex(bridge?.a)))&&b.order===1)))throw Error('reference-transition-invalid-condensation');
  function reverseIndex(index){return [...mapping].find(([,r])=>r===index)?.[0];}
  if(mapping.size+removed.size!==finite.atoms.length||[...removed].some(i=>mapping.has(i)))throw Error('reference-transition-incomplete-mapping');
  for(const [key,order] of finiteEdges){const [a,b]=key.split(':').map(Number);if(removed.has(a)||removed.has(b))continue;if(planEdges.get(edgeKey(mapping.get(a),mapping.get(b)))!==order)throw Error('reference-transition-missing-bond');}
  const reverse=new Map([...mapping].map(([f,r])=>[r,f]));
  for(const [key,order] of planEdges){const [a,b]=key.split(':').map(Number);if(used.has(a)&&used.has(b)){
    if(finiteEdges.get(edgeKey(reverse.get(a),reverse.get(b)))!==order)throw Error('reference-transition-extra-bond');
  }}
  if(!bridge||!used.has(bridge.a)||used.has(bridge.b)||!planEdges.has(edgeKey(bridge.a,bridge.b)))throw Error('reference-transition-invalid-bridge');
  return result;
}
