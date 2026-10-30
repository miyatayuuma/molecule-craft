import {REACTION_CATALOG} from './reaction-lab-catalog.js?v=1';

// Classification is metadata only; the referenced definitions remain the reaction authority.
const normalTags={
  'complete-01-anhydride-hydrolysis':['hydrolysis'],
  'complete-02-anhydride-alcoholysis':['esterification'],
  'complete-03-aspirin-synthesis':['esterification'],
  'complete-04-aspirin-hydrolysis':['hydrolysis'],
  'complete-05-amide-alcoholysis':['substitution'],
  'complete-06-ethene-halogenation':['addition','halogenation'],
  'complete-07-sulfur-trioxide-hydration':['addition','hydration'],
  'complete-08-phosphorus-pentachloride-formation':['addition','halogenation','oxidation'],
  'complete-09-ethylene-oxide-acid-cleavage':['ring-opening'],
  'complete-10-ethylene-oxide-basic-cleavage':['ring-opening'],
  'complete-11-propene-hydration':['addition','hydration'],
  'complete-12-1-butene-hydration':['addition','hydration'],
  'complete-13-2-butene-hydration':['addition','hydration'],
  'complete-14-isobutene-hydration':['addition','hydration'],
  'complete-15-cyclohexene-hydration':['addition','hydration'],
  'complete-16-methane-chlorination':['substitution','halogenation'],
  'complete-17-chloromethane-chlorination':['substitution','halogenation'],
  'complete-18-dichloromethane-chlorination':['substitution','halogenation'],
  'complete-19-chloroform-chlorination':['substitution','halogenation'],
  'complete-20-hydrogen-chlorination':['halogenation'],
  'complete-21-cyclobutane-dimerization':['cycloaddition'],
  'complete-22-dimethyl-sulfide-oxidation':['oxidation'],
  'complete-23-methanol-dehydration':['dehydration','condensation'],
  'complete-24-urea-hydrolysis':['hydrolysis'],
  'complete-25-carbonyl-sulfide-hydrolysis':['hydrolysis'],
  'complete-26-hydrogen-combustion':['oxidation','combustion'],
  'complete-27-carbon-monoxide-oxidation':['oxidation'],
  'complete-28-methane-combustion':['oxidation','combustion'],
  'complete-29-difluoromethane-combustion':['oxidation','combustion'],
};
export function createReactionCatalogAuthority({polymerRoutes=[],normalReactions=REACTION_CATALOG}={}){
  const entries=[...normalReactions.map(definition=>({reactionId:`normal:${definition.id}`,kind:'normal',definition,encyclopediaIncluded:true,categoryTags:[...(normalTags[definition.id]??[])]})),...polymerRoutes.map(definition=>({reactionId:`polymer:${definition.routeId}`,kind:'polymer',definition,encyclopediaIncluded:true,categoryTags:['polymerization',...(definition.transformFamilies?.some(f=>f==='ester-condensation'||f==='amide-condensation'||f==='phenol-methylene-bridge')?['condensation']:[]),...(definition.transformFamilies?.includes('epoxide')?['ring-opening']:[]),...(definition.transformFamilies?.includes('ester-condensation')?['esterification']:[])]}))];
  const byId=new Map(entries.map(entry=>[entry.reactionId,entry]));
  if(byId.size!==entries.length)throw Error('duplicate-reaction-id');
  return Object.freeze({get:id=>byId.get(id)??null,tags:id=>[...(byId.get(id)?.categoryTags??[])],entries:()=>[...entries],includedIds:()=>new Set(entries.filter(entry=>entry.encyclopediaIncluded).map(entry=>entry.reactionId)),count:()=>entries.filter(entry=>entry.encyclopediaIncluded).length});
}
