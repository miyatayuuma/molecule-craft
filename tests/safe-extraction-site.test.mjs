import test from 'node:test';
import assert from 'node:assert/strict';
import {createMap,SAFE_EXTRACTION_SITE} from '../src/veil/map.js';
import {flightConfig} from '../src/veil/growth.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {OXYGEN_ROUTES,OXYGEN_THERMAL,oxygenMergeRecoveryAt} from '../src/veil/oxygen-routes.js';
import {NITROGEN_RECOVERY_AREA,nitrogenRecoveryAt} from '../src/veil/nitrogen-routes.js';
import {isInsideSafeExtractionSite} from '../src/veil/safe-extraction-sites.js';

const productionMap=seed=>createUniverse(seed,{H:0,C:0,N:0,O:0},{capabilities:{nitrogenField:true}});
const ids=['hydrogen-safe-extraction','oxygen-network-merge-extraction','nitrogen-recovery-shelf-extraction'];

test('production Safe Extraction Sites reuse fixed, traversable recovery geometry',()=>{
  const maps=[1,2,17,987654].map(productionMap),baseline=maps[0].safeExtractionSites;
  assert.deepEqual(baseline.map(site=>site.id),ids);
  assert.deepEqual(baseline.map(({x,y})=>[x,y]),maps.at(-1).safeExtractionSites.map(({x,y})=>[x,y]),'site locations must not reroll with map seeds');
  const hydrogen=baseline[0],oxygen=baseline[1],nitrogen=baseline[2];
  assert.equal(hydrogen.x,SAFE_EXTRACTION_SITE.x);assert.equal(hydrogen.y,SAFE_EXTRACTION_SITE.y);assert.equal(hydrogen.route,'safe');
  assert.equal(oxygen.geometry,OXYGEN_THERMAL.mergeRecovery,'Oxygen shares the existing network-merge recovery authority');assert.equal(oxygenMergeRecoveryAt(oxygen.center),true);
  assert.equal(nitrogen.geometry,NITROGEN_RECOVERY_AREA,'Nitrogen site shares the authored shelf object');assert.equal(nitrogenRecoveryAt(nitrogen.center),NITROGEN_RECOVERY_AREA);
  for(const map of maps){
    assert.equal(map.safeExtractionSites.length,3);
    for(const site of map.safeExtractionSites){
      assert.equal(isInsideSafeExtractionSite(site.center,map.safeExtractionSites),true);
      assert.ok(map.routes.some(route=>route.id===site.route),`${site.id} route must exist in its production map`);
      assert.ok(map.fields.every(field=>Math.hypot(field.x-site.x,field.y-site.y)>site.radius+field.radius),`${site.id} stays clear of authored map hazards`);
      const environment=environmentAt(site.center,0,map);
      assert.ok(environment.heat<10,`${site.id} must not be a thermal hazard pocket`);
      assert.ok(Math.abs(environment.pressure)<100,`${site.id} must remain a calm recovery area`);
    }
  }
  for(const route of OXYGEN_ROUTES)assert.ok(Math.min(...route.knots.map(([x,y])=>Math.hypot(x-oxygen.x,y-oxygen.y)))<oxygen.radius,`${route.id} reaches the shared merge site`);
  assert.ok(Math.min(...maps[0].routes.find(route=>route.id==='nitrogen-main').points.map(point=>Math.hypot(point.x-nitrogen.x,point.y-nitrogen.y)))<nitrogen.radius+50,'Nitrogen recovery shelf stays one short maneuver off the main route');
  assert.equal(isInsideSafeExtractionSite(flightConfig().spawn,baseline),false,'spawn remains outside every Safe Site');
  assert.equal(isInsideSafeExtractionSite({x:hydrogen.x+hydrogen.radius+1,y:hydrogen.y},hydrogen),false);
  assert.equal(isInsideSafeExtractionSite({x:oxygen.x,y:oxygen.geometry.top+1},oxygen),false,'Oxygen extraction respects the existing clipped merge geometry');
});

test('Safe Site authority activates only for authored FIELD layers',()=>{
  const base=createMap(1),withoutNitrogen=createUniverse(1,{},{}),withNitrogen=productionMap(1);
  assert.deepEqual(base.safeExtractionSites.map(site=>site.id),[ids[0]]);
  assert.deepEqual(withoutNitrogen.safeExtractionSites.map(site=>site.id),ids.slice(0,2));
  assert.deepEqual(withNitrogen.safeExtractionSites.map(site=>site.id),ids);
});
