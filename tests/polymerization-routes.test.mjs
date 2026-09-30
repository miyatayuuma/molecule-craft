import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  POLYMER_PROCESS_SETUP_TOKENS,POLYMERIZATION_BUILDERS,POLYMERIZATION_ROUTE_COUNT,
  POLYMERIZATION_TRANSFORM_FAMILIES,resolvePolymerizationRoute,
  setPolymerizationRouteAuthority,validatePolymerizationRouteAuthority,
} from '../src/polymerization-routes.js';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const authority=await readJson('../data/polymerization-routes.json');
const polymers=await readJson('../data/polymers.json');
const routeSpecies=new Set(authority.routes.flatMap(route=>route.feedSpecies));
const molecules=(await readJson('../data/molecules.json')).filter(record=>routeSpecies.has(record.id));

test('the independent polymer route authority owns all 25 catalog entries and exact unique Feeds',()=>{
  const validated=validatePolymerizationRouteAuthority(authority,{polymers,molecules});
  assert.equal(validated.routes.length,POLYMERIZATION_ROUTE_COUNT);
  assert.equal(validated.builders.length,3);
  assert.deepEqual(validated.builders,[...POLYMERIZATION_BUILDERS]);
  assert.deepEqual(validated.transformFamilies,[...POLYMERIZATION_TRANSFORM_FAMILIES]);
  assert.deepEqual(validated.processSetupTokens,[...POLYMER_PROCESS_SETUP_TOKENS]);
  assert.equal(new Set(validated.routes.map(route=>route.polymerId)).size,25);
  assert.equal(new Set(validated.routes.map(route=>[...route.feedSpecies].sort().join('|'))).size,25);
  setPolymerizationRouteAuthority(authority,{polymers,molecules});
  for(const route of validated.routes){
    assert.equal(resolvePolymerizationRoute(route.feedSpecies)?.routeId,route.routeId);
    assert.equal(resolvePolymerizationRoute([...route.feedSpecies,'water']),null);
    assert.equal(route.interactionCadence.manualSteps+route.interactionCadence.automaticSteps,route.completionEvidence.unitCount-1);
  }
});

test('invalid, ambiguous, or chemistry-mismatched route authorities fail closed',()=>{
  const clone=()=>structuredClone(authority);
  const wrongVersion=clone();wrongVersion.schemaVersion=2;
  assert.throws(()=>validatePolymerizationRouteAuthority(wrongVersion,{polymers,molecules}),/envelope/);
  const duplicateFeed=clone();duplicateFeed.routes[1].feedSpecies=[...duplicateFeed.routes[0].feedSpecies];
  assert.throws(()=>validatePolymerizationRouteAuthority(duplicateFeed,{polymers,molecules}),/Feed/);
  const wrongPolymer=clone();wrongPolymer.routes[0].polymerId='polypropylene';
  assert.throws(()=>validatePolymerizationRouteAuthority(wrongPolymer,{polymers,molecules}),/duplicate polymer route target|differs from polymer reactants/);
  const unknownPattern=clone();unknownPattern.routes[0].sitePatternIds=['not-a-pattern'];
  assert.throws(()=>validatePolymerizationRouteAuthority(unknownPattern,{polymers,molecules}),/site-pattern/);
});
