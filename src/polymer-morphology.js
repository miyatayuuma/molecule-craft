// Representative material visualization, never chemistry, stock, or processing authority.
export const MORPHOLOGY_ARCHETYPES=Object.freeze(['ordered-domain','bulky-entangled','flexible-coils','cohesive-ensemble','connected-network']);
export const MORPHOLOGY_BUDGET=Object.freeze({feedCapacity:24,chains:32,pointsPerChain:65,networkMembers:144,objects:8,geometries:5,materials:5,vertices:80000});
const profile=(id,archetype,signature,qualification,{bulk=0,stiffness=1,rhythm=0}={})=>Object.freeze({polymerId:id,archetype,bulk,stiffness,rhythm,signature,qualification});
export const POLYMER_VISUAL_PROFILES=Object.freeze([
  profile('polyethylene','ordered-domain','Folded local domains and disordered connecting chains','Crystallization and branching depend on processing.'),
  profile('polypropylene','ordered-domain','Methyl-bearing locally folded chains','Order depends on tacticity; route does not establish tacticity.',{bulk:.35}),
  profile('ethylene-propylene-copolymer','flexible-coils','Irregular coils with intermittent methyl bulk','Composition/sequence are schematic, not an alternating copolymer claim.',{bulk:.35,rhythm:3}),
  profile('polyisobutylene','flexible-coils','Thicker rounded coils','Uncrosslinked ensemble; no vulcanization.',{bulk:.55}),
  profile('polystyrene','bulky-entangled','Pendant ring outlines on broad persistent bends','Representative disordered PS; tacticity is unspecified.',{bulk:1,stiffness:1.5}),
  profile('polyvinyl-chloride','bulky-entangled','Small pendant markers and constrained bends','No claim of a fixed crystallinity.',{bulk:.45,stiffness:1.25}),
  profile('polychlorotrifluoroethylene','ordered-domain','Thick locally folded fluoropolymer chains','Order is schematic; thermal history is unspecified.',{bulk:.6,stiffness:1.35}),
  profile('polyacrylonitrile','cohesive-ensemble','Short locally associated segments with nitrile markers','PAN precursor only; no carbonization or drawn fiber.',{bulk:.3,stiffness:1.5}),
  profile('polyacrylic-acid','cohesive-ensemble','Associated bent chains with acid-group markers','Association depends on hydration and ionization.',{bulk:.5,stiffness:1.1}),
  profile('polyethylene-oxide','ordered-domain','Soft folds and flexible disordered bridges','Crystallinity depends on molecular weight and temperature.',{stiffness:.8}),
  profile('polyethylene-terephthalate','cohesive-ensemble','Persistent aromatic spans among bent chains','No spinning/drawing; PET can be amorphous or semicrystalline.',{bulk:.75,stiffness:1.7,rhythm:2}),
  profile('polyethylene-adipate','ordered-domain','Soft folds with spaced ester markers','Representative order tendency, not a cooling simulation.',{bulk:.2,stiffness:.9,rhythm:2}),
  profile('polylactic-acid','bulky-entangled','Methyl-bearing ester coils','Stereochemistry is unspecified; crystallinity is not asserted.',{bulk:.35,stiffness:1.2}),
  profile('polyglycolic-acid','ordered-domain','Compact folds with ester rhythm','Crystallization is processing dependent.',{bulk:.15,rhythm:2}),
  profile('phenol-formaldehyde-resin','connected-network','Branch junctions and connected depth-spanning members','Extension of the existing finite network builder; not a separate curing step.',{bulk:1,stiffness:1.8}),
  profile('polyethylene-adipamide','cohesive-ensemble','Local associated spans with amide rhythm','No fiber drawing or guaranteed crystallinity.',{bulk:.2,stiffness:1.2,rhythm:2}),
  profile('polybutadiene','flexible-coils','Fine strongly curled entangled chains','Unvulcanized; cis/trans microstructure is unspecified.',{stiffness:.7}),
  profile('styrene-butadiene-copolymer','flexible-coils','Soft coils with intermittent pendant rings','Unvulcanized; schematic sequence, no imposed block order.',{bulk:1,stiffness:.8,rhythm:3}),
  profile('nitrile-butadiene-rubber','flexible-coils','Fine coils with intermittent nitrile markers','Unvulcanized; composition is not simulated.',{bulk:.3,stiffness:.85,rhythm:3}),
  profile('polyisoprene','flexible-coils','Curled chains with small methyl protrusions','Unvulcanized; no cis/trans claim.',{bulk:.3,stiffness:.7}),
  profile('butyl-rubber','flexible-coils','Thick soft coils with sparse sequence accents','Unvulcanized; no sulfur links.',{bulk:.55,stiffness:.8,rhythm:7}),
  profile('polyvinylidene-fluoride','ordered-domain','Compact folded fluoropolymer domains','No specific crystal polymorph or piezoelectric processing.',{bulk:.4,stiffness:1.15}),
  profile('vinylidene-fluoride-hexafluoropropylene-copolymer','flexible-coils','Thick coils with irregular bulky interruptions','No imposed composition, crystallinity, or crosslinking.',{bulk:.7,stiffness:1.05,rhythm:3}),
  profile('polytetrafluoroethylene','ordered-domain','Persistent thick fluorinated folds','No sintering, drawing, or manufactured fibrils.',{bulk:.6,stiffness:1.7}),
  profile('nylon-6-6','cohesive-ensemble','Associated amide spans joined by flexible bends','No spinning/drawing; local cohesion only.',{bulk:.2,stiffness:1.3,rhythm:2}),
]);
export function validateMorphologyAuthority(polymers,routes,profiles=POLYMER_VISUAL_PROFILES){
  const ids=new Set(polymers.map(p=>p.id)),seen=new Set();
  for(const p of profiles){
    if(!ids.has(p.polymerId)||seen.has(p.polymerId)||!MORPHOLOGY_ARCHETYPES.includes(p.archetype))throw Error('Invalid morphology mapping: '+p.polymerId);
    for(const [key,max] of [['bulk',1],['stiffness',2],['rhythm',7]])if(!Number.isFinite(p[key])||p[key]<0||p[key]>max)throw Error('Invalid visual domain: '+key);
    if(!p.signature||!p.qualification)throw Error('Missing scientific qualification');
    const network=polymers.find(item=>item.id===p.polymerId).topology==='network';
    if(network!==(p.archetype==='connected-network'))throw Error('Network morphology mismatch');
    seen.add(p.polymerId);
  }
  if(seen.size!==ids.size)throw Error('Missing morphology profile');
  for(const r of routes)if(!seen.has(r.polymerId))throw Error('Unmapped route');
  return seen.size;
}
function randomFor(id){let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619);return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function createMorphologyPlan(polymerId){
  const p=POLYMER_VISUAL_PROFILES.find(p=>p.polymerId===polymerId);if(!p)throw Error('Unknown morphology: '+polymerId);
  const random=randomFor(polymerId),strands=[];
  if(p.archetype==='connected-network'){
    const nodes=[];for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)nodes.push([(x-1.5)*2.6+(random()-.5)*2,(y-1.5)*2.6+(random()-.5)*2,(z-1.5)*2+(random()-.5)*2]);
    for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=x+y*4+z*16;for(const [valid,d] of [[x<3,1],[y<3,4],[z<3,16]])if(valid){const a=nodes[i],b=nodes[i+d],points=[];for(let k=0;k<=8;k++){const t=k/8;points.push(k==0?[...a]:k==8?[...b]:a.map((v,j)=>v+(b[j]-v)*t+Math.sin(t*Math.PI)*.18*Math.sin(i+j)));}strands.push(points);}}
  }else for(let i=0;i<MORPHOLOGY_BUDGET.chains;i++){
    const phase=random()*Math.PI*2,center=[(random()-.5)*5.5,(random()-.5)*5.5,(random()-.5)*4],points=[];
    for(let k=0;k<MORPHOLOGY_BUDGET.pointsPerChain;k++){
      const t=k/64,a=phase+t*Math.PI*(p.archetype==='flexible-coils'?8:4)/p.stiffness;
      let point;
      if(p.archetype==='ordered-domain'&&i<16){const fold=t*6,run=Math.floor(fold),f=fold-run;point=[(i%4-1.5)*2.2+(run-2.5)*.28,(run%2?1-f:f)*4-2,(Math.floor(i/4)-1.5)*1.3+Math.sin(t*Math.PI*2)*.12];}
      else if(p.archetype==='cohesive-ensemble'&&i<20){const local=i%5;point=[Math.sin(a)*1.8+(Math.floor(i/5)-1.5)*1.5,t*8-4+Math.sin(a*2)*.25,Math.cos(a)*.65+(local-2)*.32];}
      else{const radius=p.archetype==='flexible-coils'?1.5:2.3;point=[center[0]+Math.sin(a)*radius,center[1]+Math.sin(a*.73+phase)*radius,center[2]+Math.cos(a*.91)*radius*.75];}
      points.push(point);
    }strands.push(points);
  }
  // Fixed oblique view exposes depth without introducing camera orbit.
  const angle=.38;for(const strand of strands)for(const point of strand){const [x,y,z]=point;point[0]=x*Math.cos(angle)+z*Math.sin(angle);point[1]=y*Math.cos(.18)-z*Math.sin(.18);point[2]=-x*Math.sin(angle)+z*Math.cos(angle);}
  return{polymerId,profile:p,strands,budget:MORPHOLOGY_BUDGET,representative:true};
}
export function cinematicFrame(elapsedMs,reducedMotion=false){
  const durations=reducedMotion?[180,200,200,650,250]:[900,1200,1200,1200,600],names=['bulk-feed','scale-out','ensemble-growth','morphology-hold','collapse'];
  let offset=0;for(let i=0;i<durations.length;i++){if(elapsedMs<offset+durations[i])return{phase:names[i],progress:Math.max(0,(elapsedMs-offset)/durations[i]),index:i,done:false};offset+=durations[i];}
  return{phase:'complete',progress:1,index:5,done:true};
}
