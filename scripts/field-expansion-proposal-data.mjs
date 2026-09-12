export const PROPOSAL_NOTICE='PROPOSAL ONLY — not implemented in FIELD gameplay';

export const GATE_TAXONOMY=Object.freeze({
  G0:'OPEN',
  G1:'EQUIPMENT ADVANTAGE',
  G2:'SKILL BYPASS',
  G3:'CAPABILITY GATE',
});

export const ANCHORS=Object.freeze({
  oxygenAnchor:{x:170,y:-8090,label:'Oxygen anchor'},
  oxygenJunction:{x:120,y:-8700,label:'Oxygen junction'},
  oxygenNetworkMerge:{x:120,y:-10670,label:'Oxygen network merge'},
  frontierApproach:{x:100,y:-11830,label:'Deep Oxygen exit / Frontier approach'},
  frontierAnchor:{x:100,y:-11920,label:'Frontier anchor'},
  choDestination:{x:280,y:-12470,label:'CHO destination'},
  currentVortexApprox:{x:-500,y:-8380,label:'CURRENT vortex · optional skill/reward pocket'},
});

export const ROUTES=Object.freeze({
  hRevisit:{
    id:'proposal-h-revisit',layer:'layer-proposed-h-revisit',label:'H revisit pocket',gateClass:'G0 / G1',widthIntent:'optional loop',
    points:[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]],
    role:'Optional revisit; very high H candidate; initially reachable; later BURST/DRIVE makes the loop clearly easier.',
  },
  cRevisit:{
    id:'proposal-c-revisit',layer:'layer-proposed-c-revisit',label:'C revisit pocket',gateClass:'G0 / G1',widthIntent:'long optional loop',
    points:[[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]],
    role:'Optional revisit; very high C candidate; normal movement remains possible; DRIVE strongly improves collection efficiency.',
  },
  oxygenEntry:{
    id:'proposal-oxygen-entry',layer:'layer-proposed-oxygen-entry',label:'Oxygen Entry',gateClass:'G1',widthIntent:'wide',
    points:[[170,-8090],[420,-8300],[420,-8500],[120,-8700]],
    role:'Safe-biased O₂ introduction; low hazard/heat; sustained COMBUSTION DRIVE should feel comfortable before route pressure rises.',
  },
  oxygenBurst:{
    id:'proposal-oxygen-burst',layer:'layer-proposed-oxygen-burst',label:'Route A · BURST advantage',gateClass:'G1 + G2',widthIntent:'narrow with one localized chokepoint',
    points:[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]],
    role:'Shortest/time-efficient route; one localized high-pressure chokepoint; BURST helps while high-skill normal traversal remains possible.',
  },
  oxygenDrive:{
    id:'proposal-oxygen-drive',layer:'layer-proposed-oxygen-drive',label:'Route B · DRIVE advantage',gateClass:'G1',widthIntent:'wide sustained travel',
    points:[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]],
    role:'Wide stable harvesting route; moderate continuous resistance; normal movement remains possible; COMBUSTION DRIVE value is clearest here.',
  },
  oxygenThermal:{
    id:'proposal-oxygen-thermal',layer:'layer-proposed-oxygen-thermal',label:'Route C · THERMAL advantage',gateClass:'G1 → G3 candidate',widthIntent:'wide',
    points:[[120,-8700],[780,-9000],[850,-10350],[120,-10670]],
    role:'High-O route with pressure kept low; relative heat rises with depth; H₂O becomes a strong advantage only in the deep section.',
  },
  deepSafe:{
    id:'proposal-deep-safe',layer:'layer-proposed-deep-safe',label:'Deep Route A · Safe Long',gateClass:'G0 / G1',widthIntent:'wide long route',
    points:[[120,-10800],[-650,-11000],[-720,-11450],[100,-11830]],
    role:'Longest and safer route; lower pressure, low-to-medium heat, medium resource efficiency; coolant is not required for stable traversal.',
  },
  deepSkill:{
    id:'proposal-deep-skill',layer:'layer-proposed-deep-skill',label:'Deep Route B · Skill Fast',gateClass:'G2',widthIntent:'precision corridor',
    points:[[120,-10800],[100,-11200],[100,-11830]],
    role:'Shortest deep route; curve/current/precision traversal; BURST helps but high-skill bypass remains possible.',
  },
  deepThermal:{
    id:'proposal-deep-thermal',layer:'layer-proposed-deep-thermal',label:'Deep Route C · High Thermal Reward',gateClass:'G1 → partial G3',widthIntent:'wide reward route',
    points:[[120,-10800],[760,-11050],[760,-11500],[100,-11830]],
    role:'Highest resource efficiency with high heat and mixed H/C/O; H₂O is strongly advantageous; only a deep subsection is a G3 candidate.',
  },
});

export const RECOVERY_ZONES=Object.freeze([
  {id:'recovery-oxygen-entry',x:300,y:-8580,rx:220,ry:130,label:'Recovery 1 · Oxygen Entry exit'},
  {id:'recovery-network-mid',x:300,y:-9750,rx:220,ry:170,label:'Recovery 2 · DRIVE harvest / route choice'},
  {id:'recovery-network-merge',x:120,y:-10800,rx:260,ry:150,label:'Recovery 3 · network merge chamber'},
  {id:'recovery-frontier-approach',x:100,y:-11700,rx:250,ry:130,label:'Recovery 4 · before Frontier approach'},
]);

export const DENSITY_INTENTS=Object.freeze([
  {id:'density-h-mainline',element:'H',x:0,y:-1450,rx:650,ry:1350,level:'medium',label:'H Veil mainline · medium H'},
  {id:'density-h-revisit',element:'H',x:-800,y:-2650,rx:300,ry:500,level:'very-high',label:'H revisit · very high H'},
  {id:'density-c-shallow',element:'C',x:50,y:-5000,rx:850,ry:620,level:'low',label:'Carbon shallow · low C'},
  {id:'density-c-deep',element:'C',x:50,y:-6750,rx:850,ry:950,level:'high',label:'Carbon deeper · high C'},
  {id:'density-c-revisit',element:'C',x:780,y:-6200,rx:400,ry:900,level:'very-high',label:'C revisit · very high C'},
  {id:'density-o-entry',element:'O',x:260,y:-8420,rx:500,ry:430,level:'low-to-medium',label:'Oxygen Entry · O low → medium; H low; C medium'},
  {id:'density-o-burst',element:'O',x:-300,y:-9650,rx:300,ry:1250,level:'low-to-medium',label:'BURST route · O low–medium'},
  {id:'density-o-drive',element:'O',x:300,y:-9700,rx:300,ry:1250,level:'medium-stable',label:'DRIVE route · O medium / stable'},
  {id:'density-o-thermal',element:'O',x:800,y:-9700,rx:390,ry:1250,level:'high',label:'THERMAL route · O high'},
  {id:'density-o-deep-safe',element:'O',x:-360,y:-11330,rx:560,ry:650,level:'mixed-medium',label:'Deep safe · mixed medium'},
  {id:'density-o-deep-skill',element:'O',x:100,y:-11350,rx:250,ry:620,level:'mixed-medium-high',label:'Deep skill · mixed medium-high'},
  {id:'density-o-deep-thermal',element:'O',x:650,y:-11300,rx:540,ry:690,level:'mixed-high-to-very-high',label:'Deep thermal reward · mixed high / very high'},
]);

export const THERMAL_INTENTS=Object.freeze([
  {id:'thermal-entry-cool',kind:'cool-neutral',x:300,y:-8420,rx:500,ry:430,label:'cool / neutral introduction'},
  {id:'thermal-route-c-warm',kind:'warm',x:800,y:-9300,rx:360,ry:520,label:'warm gradient candidate'},
  {id:'thermal-route-c-hot-learning',kind:'hot-learning',x:830,y:-10020,rx:360,ry:520,label:'HOT-learning candidate'},
  {id:'thermal-deep-high',kind:'high-thermal',x:650,y:-11310,rx:540,ry:660,label:'deep high-thermal candidate'},
  ...RECOVERY_ZONES.map(zone=>({id:`thermal-${zone.id}`,kind:'recovery',x:zone.x,y:zone.y,rx:zone.rx,ry:zone.ry,label:'recovery / low heat'})),
]);

export const GATE_MARKERS=Object.freeze([
  {id:'gate-h-revisit-open',route:'proposal-h-revisit',gate:'G0',x:-650,y:-2270,label:'initially open'},
  {id:'gate-h-revisit-advantage',route:'proposal-h-revisit',gate:'G1',x:-850,y:-2850,label:'BURST / DRIVE advantage'},
  {id:'gate-c-revisit-open',route:'proposal-c-revisit',gate:'G0',x:930,y:-5700,label:'normal movement possible'},
  {id:'gate-c-revisit-advantage',route:'proposal-c-revisit',gate:'G1',x:900,y:-6500,label:'DRIVE efficiency advantage'},
  {id:'gate-oxygen-entry',route:'proposal-oxygen-entry',gate:'G1',x:420,y:-8400,label:'DRIVE comfort advantage'},
  {id:'gate-burst-advantage',route:'proposal-oxygen-burst',gate:'G1',x:-170,y:-8900,label:'BURST advantage'},
  {id:'gate-burst-skill-bypass',route:'proposal-oxygen-burst',gate:'G2',x:-320,y:-9700,label:'localized pressure chokepoint / skill bypass'},
  {id:'gate-drive-advantage',route:'proposal-oxygen-drive',gate:'G1',x:350,y:-9550,label:'sustained DRIVE advantage'},
  {id:'gate-thermal-advantage',route:'proposal-oxygen-thermal',gate:'G1',x:780,y:-9300,label:'thermal equipment advantage begins'},
  {id:'gate-thermal-deep-candidate',route:'proposal-oxygen-thermal',gate:'G3',candidate:true,x:850,y:-10200,label:'deep capability-gate candidate only'},
  {id:'gate-deep-safe-open',route:'proposal-deep-safe',gate:'G0',x:-260,y:-10900,label:'safe route open'},
  {id:'gate-deep-safe-advantage',route:'proposal-deep-safe',gate:'G1',x:-680,y:-11300,label:'equipment improves efficiency'},
  {id:'gate-deep-skill',route:'proposal-deep-skill',gate:'G2',x:100,y:-11350,label:'precision / current skill bypass'},
  {id:'gate-deep-thermal-advantage',route:'proposal-deep-thermal',gate:'G1',x:620,y:-11020,label:'H₂O strongly advantageous'},
  {id:'gate-deep-thermal-candidate',route:'proposal-deep-thermal',gate:'G3',candidate:true,x:760,y:-11450,label:'partial deep capability-gate candidate'},
]);

export const CHALLENGE_INTENTS=Object.freeze([
  {id:'challenge-pulse-candidate',type:'pulse',x:-320,y:-9650,route:'proposal-oxygen-burst',label:'pulse · BURST route candidate'},
  {id:'challenge-curve-candidate',type:'curve',x:100,y:-11450,route:'proposal-deep-skill',label:'curve · Deep Skill candidate'},
  {id:'challenge-thermal-candidate',type:'thermal',x:760,y:-11300,route:'proposal-deep-thermal',label:'thermal · Deep Thermal candidate'},
]);

export const SIGNAL_INTENTS=Object.freeze([
  {id:'signal-network-candidate',x:520,y:-9250,r:170,complexity:'route-choice',label:'signal candidate · route-choice complexity'},
  {id:'signal-deep-candidate',x:-280,y:-11100,r:170,complexity:'deep',label:'signal candidate · deep complexity'},
  {id:'signal-frontier-candidate',x:100,y:-11620,r:150,complexity:'frontier',label:'signal candidate · Frontier complexity'},
]);
