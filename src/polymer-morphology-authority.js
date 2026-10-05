const ARCHETYPE_IDS=Object.freeze([
  'SEMICRYSTALLINE_DOMAINS',
  'AMORPHOUS_ENTANGLEMENT',
  'FLEXIBLE_COIL_ENSEMBLE',
  'RIGID_COHESIVE_ENSEMBLE',
  'CONNECTED_NETWORK',
]);

const freezeDeep=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value))freezeDeep(child);
  }
  return value;
};

// The cue vocabulary is intentionally small and visual: each cue selects a
// shared geometric treatment rather than adding a private renderer per polymer.
const PROFILE_ROWS=[
  ['polyethylene','SEMICRYSTALLINE_DOMAINS','flexible-lamellae','Uneven local ordered patches sit among longer disordered tie-like chains; processing-dependent crystallinity is representative only.'],
  ['polypropylene','SEMICRYSTALLINE_DOMAINS','substituted-lamellae','Local order is interrupted by bulkier contour turns; tacticity is unspecified, so no uniform crystal texture is claimed.'],
  ['ethylene-propylene-copolymer','FLEXIBLE_COIL_ENSEMBLE','mixed-soft-coils','Flexible mixed chains with intermittent contour accents; no alternating or block sequence is asserted.'],
  ['polyisobutylene','FLEXIBLE_COIL_ENSEMBLE','bulky-open-coils','Broad, loose coils suggest sterically bulky repeat units without assigning a molecular-weight distribution.'],
  ['polystyrene','AMORPHOUS_ENTANGLEMENT','bulky-amorphous','Broad, persistent amorphous loops; no crystalline domains or glassy processing state is asserted.'],
  ['polyvinyl-chloride','AMORPHOUS_ENTANGLEMENT','stiff-amorphous','Shorter, more persistent local spans in a disordered ensemble; no tacticity or plasticizer state is implied.'],
  ['polychlorotrifluoroethylene','SEMICRYSTALLINE_DOMAINS','fluorinated-lamellae','Local ordered patches with irregular boundaries; degree of crystallinity depends on grade and thermal history.'],
  ['polyacrylonitrile','RIGID_COHESIVE_ENSEMBLE','polar-persistent','Persistent chains with loose local association; this is PAN polymer, not carbonized or drawn fiber.'],
  ['polyacrylic-acid','FLEXIBLE_COIL_ENSEMBLE','polar-flexible-coils','Flexible polar-chain ensemble; ionization, solvent and hydrogen-bond state are not specified.'],
  ['polyethylene-oxide','SEMICRYSTALLINE_DOMAINS','polar-flexible-lamellae','Flexible chains with modest local ordering; crystallinity varies with molecular weight and conditions.'],
  ['polyethylene-terephthalate','RIGID_COHESIVE_ENSEMBLE','aromatic-cohesion','Persistent aromatic-containing chains with local association; no drawn textile fiber or processing texture is shown.'],
  ['polyethylene-adipate','SEMICRYSTALLINE_DOMAINS','soft-ester-domains','Flexible ester chains with small, uneven ordered patches; crystallization is condition-dependent.'],
  ['polylactic-acid','SEMICRYSTALLINE_DOMAINS','stereo-unspecified-domains','Mixed local order and disordered spans; stereochemistry and thermal history are unspecified.'],
  ['polyglycolic-acid','SEMICRYSTALLINE_DOMAINS','compact-ester-domains','Compact local association among irregularly oriented domains; no manufactured fiber form is implied.'],
  ['phenol-formaldehyde-resin','CONNECTED_NETWORK','irregular-network','A three-dimensional connected network follows the route topology; no additional curing or crosslink chemistry is added.'],
  ['polyethylene-adipamide','RIGID_COHESIVE_ENSEMBLE','amide-cohesion','Persistent polyamide chains with local association; the model does not claim a drawn fiber or a unique crystal form.'],
  ['polybutadiene','FLEXIBLE_COIL_ENSEMBLE','rubbery-open-coils','Loose flexible unvulcanized chains; sulfur crosslinks and curing are absent.'],
  ['styrene-butadiene-copolymer','FLEXIBLE_COIL_ENSEMBLE','mixed-rubbery-coils','Flexible mixed chains with intermittent bulky contour accents; sequence and vulcanization are not asserted.'],
  ['nitrile-butadiene-rubber','FLEXIBLE_COIL_ENSEMBLE','polar-rubbery-coils','Flexible mixed chains with sparse polar association accents; no sequence, solvent or curing state is asserted.'],
  ['polyisoprene','FLEXIBLE_COIL_ENSEMBLE','rubbery-long-coils','Flexible unvulcanized chains with broad persistent bends; no sulfur-crosslinked network is shown.'],
  ['butyl-rubber','FLEXIBLE_COIL_ENSEMBLE','bulky-rubbery-coils','Loose bulky mixed-chain coils; exact sequence and vulcanization are unspecified.'],
  ['polyvinylidene-fluoride','SEMICRYSTALLINE_DOMAINS','fluorinated-cohesive-domains','Irregular local ordered regions among disordered chains; phase and crystallinity depend on processing.'],
  ['vinylidene-fluoride-hexafluoropropylene-copolymer','FLEXIBLE_COIL_ENSEMBLE','fluorinated-mixed-coils','Flexible copolymer ensemble with interrupted local order; no exact sequence or phase fraction is asserted.'],
  ['polytetrafluoroethylene','SEMICRYSTALLINE_DOMAINS','fluorinated-persistent-domains','Persistent local ordered patches with uneven domain orientation; morphology depends on grade and processing.'],
  ['nylon-6-6','RIGID_COHESIVE_ENSEMBLE','amide-cohesion','Persistent polyamide chains with local cohesive association; no drawn textile fiber or fixed crystallite form is shown.'],
];

export const POLYMER_MORPHOLOGY_ARCHETYPES=ARCHETYPE_IDS;
export const POLYMER_MORPHOLOGY_PROFILES=freezeDeep(PROFILE_ROWS.map(([polymerId,archetype,visualCue,qualification])=>({polymerId,archetype,visualCue,qualification})));
const profileById=new Map(POLYMER_MORPHOLOGY_PROFILES.map(profile=>[profile.polymerId,profile]));

export function polymerMorphologyProfiles(){return POLYMER_MORPHOLOGY_PROFILES.slice();}
export function polymerMorphologyProfile(polymerId){return profileById.get(polymerId)??null;}

export function validatePolymerMorphologyAuthority({polymers,routes,profiles=POLYMER_MORPHOLOGY_PROFILES}={}){
  if(!Array.isArray(polymers)||!Array.isArray(routes)||!Array.isArray(profiles))throw new TypeError('Polymer catalog, route and morphology profile arrays are required.');
  if(polymers.length!==25||routes.length!==25||profiles.length!==25)throw new Error('Static polymer morphology authority requires exactly 25 polymers, routes and profiles.');
  const catalogIds=new Set(polymers.map(record=>record?.id)),routeById=new Map(),profileByPolymer=new Map();
  if(catalogIds.size!==25)throw new Error('Polymer catalog must contain 25 unique identities.');
  for(const route of routes){
    if(!route?.polymerId||routeById.has(route.polymerId))throw new Error(`Missing or duplicate route target: ${route?.polymerId}`);
    routeById.set(route.polymerId,route);
  }
  for(const profile of profiles){
    if(!profile?.polymerId||profileByPolymer.has(profile.polymerId))throw new Error(`Missing or duplicate morphology profile: ${profile?.polymerId}`);
    if(!ARCHETYPE_IDS.includes(profile.archetype))throw new Error(`Invalid morphology archetype for ${profile.polymerId}: ${profile.archetype}`);
    if(typeof profile.visualCue!=='string'||!profile.visualCue||typeof profile.qualification!=='string'||!profile.qualification)throw new Error(`Incomplete morphology profile: ${profile.polymerId}`);
    profileByPolymer.set(profile.polymerId,profile);
  }
  for(const id of profileByPolymer.keys())if(!catalogIds.has(id))throw new Error(`Unknown morphology polymer id: ${id}`);
  for(const id of routeById.keys())if(!catalogIds.has(id))throw new Error(`Unknown route polymer id: ${id}`);
  for(const id of catalogIds){
    const route=routeById.get(id),profile=profileByPolymer.get(id);
    if(!route)throw new Error(`Polymer route has no target: ${id}`);
    if(!profile)throw new Error(`Polymer has no morphology profile: ${id}`);
    if(route.builder==='network'&&profile.archetype!=='CONNECTED_NETWORK')throw new Error(`Network route requires connected morphology: ${id}`);
    if(route.builder!=='network'&&profile.archetype==='CONNECTED_NETWORK')throw new Error(`Connected morphology requires a network route: ${id}`);
  }
  const used=new Set([...profileByPolymer.values()].map(profile=>profile.archetype));
  for(const archetype of ARCHETYPE_IDS)if(!used.has(archetype))throw new Error(`Unused morphology archetype: ${archetype}`);
  return Object.freeze({polymerCount:catalogIds.size,profileCount:profileByPolymer.size,routeCount:routeById.size,archetypeCount:used.size,archetypes:Object.freeze([...used])});
}
