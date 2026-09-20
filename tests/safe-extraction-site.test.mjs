import test from 'node:test';
import assert from 'node:assert/strict';
import {createMap,isInsideSafeExtractionSite,SAFE_EXTRACTION_SITE} from '../src/veil/map.js';
import {flightConfig} from '../src/veil/growth.js';
import {environmentAt} from '../src/veil/universe.js';

test('Safe Extraction Site is fixed, reachable, and outside the spawn and hazard field',()=>{
  const maps=[1,2,17,987654].map(seed=>createMap(seed,{}, {capabilities:{combustionDrive:true}}));
  for(const map of maps)assert.deepEqual(map.safeExtractionSite,SAFE_EXTRACTION_SITE);
  assert.equal(isInsideSafeExtractionSite({x:SAFE_EXTRACTION_SITE.x,y:SAFE_EXTRACTION_SITE.y}),true);
  assert.equal(isInsideSafeExtractionSite({x:SAFE_EXTRACTION_SITE.x+SAFE_EXTRACTION_SITE.radius+1,y:SAFE_EXTRACTION_SITE.y}),false);
  assert.equal(isInsideSafeExtractionSite(flightConfig().spawn),false,'spawn must not enable immediate extraction');
  for(const map of maps){
    const route=map.routes.find(candidate=>candidate.id===SAFE_EXTRACTION_SITE.route);
    assert.ok(route,'authored site route must exist in production map');
    assert.ok(Math.min(...route.points.map(point=>Math.hypot(point.x-SAFE_EXTRACTION_SITE.x,point.y-SAFE_EXTRACTION_SITE.y)))<SAFE_EXTRACTION_SITE.radius,'route must pass through the extraction radius');
    assert.ok(map.fields.every(field=>Math.hypot(field.x-SAFE_EXTRACTION_SITE.x,field.y-SAFE_EXTRACTION_SITE.y)>SAFE_EXTRACTION_SITE.radius+field.radius),'site must stay clear of authored hazard fields');
  }
  const environment=environmentAt(SAFE_EXTRACTION_SITE,0);
  assert.ok(environment.heat<10,'site must not sit in an acute thermal zone');
  assert.ok(Math.abs(environment.pressure)<100,'site must not sit in an acute pressure zone');
});
