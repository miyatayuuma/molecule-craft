import { REACTION_FAMILIES, REACTION_SITE_PATTERNS } from '../../src/reaction-lab-authority.js';

// ⑦A's frozen, test-only PLAYABLE manifest. It must never be imported by a
// production application entrypoint or merged into REACTION_CATALOG.
const reaction=(id,familyId,reactants,products,requires=[],forbids=[])=>({id,familyId,reactants,products,requires,forbids});
const pair=(familyId,roleA,speciesA,roleB,speciesB)=>[{role:roleA,species:speciesA},{role:roleB,species:speciesB}];

export const COMPLETE_REACTION_FIXTURE=Object.freeze([
  reaction('complete-01-anhydride-hydrolysis','sigma-cross-exchange',pair('sigma-cross-exchange','primary','acetic-anhydride','transferPair','water'),['acetic-acid','acetic-acid'],[],['basic']),
  reaction('complete-02-anhydride-alcoholysis','sigma-cross-exchange',pair('sigma-cross-exchange','primary','acetic-anhydride','transferPair','ethanol'),['ethyl-acetate','acetic-acid'],[],['basic']),
  reaction('complete-03-aspirin-synthesis','sigma-cross-exchange',pair('sigma-cross-exchange','primary','acetic-anhydride','transferPair','salicylic-acid'),['aspirin','acetic-acid'],['acidic','heat']),
  reaction('complete-04-aspirin-hydrolysis','sigma-cross-exchange',pair('sigma-cross-exchange','primary','aspirin','transferPair','water'),['salicylic-acid','acetic-acid'],['acidic','heat']),
  reaction('complete-05-amide-alcoholysis','sigma-cross-exchange',pair('sigma-cross-exchange','primary','ethyl-acetate','transferPair','ammonia'),['acetamide','ethanol'],[],['acidic','basic']),
  reaction('complete-06-ethene-halogenation','pi-pair-addition',pair('pi-pair-addition','substrate','ethene','transferPair','chlorine'),['1-2-dichloroethane'],[],['basic']),
  reaction('complete-07-sulfur-trioxide-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','sulfur-trioxide','transferPair','water'),['sulfuric-acid'],[],['basic']),
  reaction('complete-08-phosphorus-pentachloride-formation','pair-addition-to-center',pair('pair-addition-to-center','center','phosphorus-trichloride','pair','chlorine'),['phosphorus-pentachloride'],[],['heat','basic']),
  reaction('complete-09-ethylene-oxide-acid-cleavage','sigma-cross-exchange',pair('sigma-cross-exchange','primary','ethylene-oxide','transferPair','water'),['ethylene-glycol'],['acidic']),
  reaction('complete-10-ethylene-oxide-basic-cleavage','sigma-cross-exchange',pair('sigma-cross-exchange','primary','ethylene-oxide','transferPair','water'),['ethylene-glycol'],['basic','heat']),
  reaction('complete-11-propene-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','propene','transferPair','water'),['2-propanol'],['acidic'],['heat']),
  reaction('complete-12-1-butene-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','1-butene','transferPair','water'),['2-butanol'],['acidic'],['heat']),
  reaction('complete-13-2-butene-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','2-butene','transferPair','water'),['2-butanol'],['acidic'],['heat']),
  reaction('complete-14-isobutene-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','isobutene','transferPair','water'),['tert-butanol'],['acidic'],['heat']),
  reaction('complete-15-cyclohexene-hydration','pi-pair-addition',pair('pi-pair-addition','substrate','cyclohexene','transferPair','water'),['cyclohexanol'],['acidic'],['heat']),
  reaction('complete-16-methane-chlorination','sigma-cross-exchange',pair('sigma-cross-exchange','primary','methane','transferPair','chlorine'),['chloromethane','hydrogen-chloride'],['light'],['basic']),
  reaction('complete-17-chloromethane-chlorination','sigma-cross-exchange',pair('sigma-cross-exchange','primary','chloromethane','transferPair','chlorine'),['dichloromethane','hydrogen-chloride'],['light'],['basic']),
  reaction('complete-18-dichloromethane-chlorination','sigma-cross-exchange',pair('sigma-cross-exchange','primary','dichloromethane','transferPair','chlorine'),['chloroform','hydrogen-chloride'],['light'],['basic']),
  reaction('complete-19-chloroform-chlorination','sigma-cross-exchange',pair('sigma-cross-exchange','primary','chloroform','transferPair','chlorine'),['carbon-tetrachloride','hydrogen-chloride'],['light'],['basic']),
  reaction('complete-20-hydrogen-chlorination','sigma-cross-exchange',pair('sigma-cross-exchange','primary','hydrogen','transferPair','chlorine'),['hydrogen-chloride','hydrogen-chloride'],['light'],['basic']),
  reaction('complete-21-cyclobutane-dimerization','double-pair-cycloaddition',pair('double-pair-cycloaddition','alkeneA','ethene','alkeneB','ethene'),['cyclobutane'],['light']),
  reaction('complete-22-dimethyl-sulfide-oxidation','oxygen-atom-transfer',pair('oxygen-atom-transfer','sulfide','dimethyl-sulfide','peroxide','hydrogen-peroxide'),['dimethyl-sulfoxide','water']),
  reaction('complete-23-methanol-dehydration','sigma-cross-exchange',pair('sigma-cross-exchange','primary','methanol','transferPair','methanol'),['dimethyl-ether','water'],['acidic','heat']),
  reaction('complete-24-urea-hydrolysis','bis-leaving-hydrolysis',pair('bis-leaving-hydrolysis','urea','urea','water','water'),['ammonia','ammonia','carbon-dioxide'],['heat'],['acidic','basic']),
  reaction('complete-25-carbonyl-sulfide-hydrolysis','heterocumulene-hydrolysis',pair('heterocumulene-hydrolysis','cos','carbonyl-sulfide','water','water'),['carbon-dioxide','hydrogen-sulfide'],['heat'],['basic']),
  reaction('complete-26-hydrogen-combustion','hydrogen-combustion',[
    {role:'hydrogenA',species:'hydrogen'},{role:'oxygen',species:'oxygen'},{role:'hydrogenB',species:'hydrogen'},
  ],['water','water'],['heat']),
  reaction('complete-27-carbon-monoxide-oxidation','triple-bond-diatomic-oxidation',[
    {role:'coA',species:'carbon-monoxide'},{role:'oxygen',species:'oxygen'},{role:'coB',species:'carbon-monoxide'},
  ],['carbon-dioxide','carbon-dioxide'],['heat']),
  reaction('complete-28-methane-combustion','methane-combustion',[
    {role:'methane',species:'methane'},{role:'oxygenA',species:'oxygen'},{role:'oxygenB',species:'oxygen'},
  ],['carbon-dioxide','water','water'],['heat']),
  reaction('complete-29-difluoromethane-combustion','halomethane-combustion',pair('halomethane-combustion','halomethane','difluoromethane','oxygen','oxygen'),['carbon-dioxide','hydrogen-fluoride','hydrogen-fluoride'],['heat']),
]);

export const COMPLETE_REACTION_AUTHORITY=Object.freeze({patterns:REACTION_SITE_PATTERNS,families:REACTION_FAMILIES,reactions:COMPLETE_REACTION_FIXTURE});
