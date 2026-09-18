import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';
import {createUniverse} from '../src/veil/universe.js';
import {GROWTH,flightConfig} from '../src/veil/growth.js';
import {NITROGEN_CORE,NITROGEN_HAZARDS,NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_RECOVERY_AREAS,NITROGEN_ROUTE,NITROGEN_ZONES} from '../src/veil/nitrogen-routes.js';
const fmt=value=>String(Math.round(value*1000)/1000).replace(/^-0$/,'0');

test('Current FIELD developer map exposes Nitrogen v2 geometry without implying a player-facing belt',()=>{
  const svg=buildFieldMapSvg(),dynamic=flightConfig({progress:{choCompleted:true},elements:{N:0}}).bounds,universe=createUniverse(1,{H:0,C:0,N:0,O:0},{capabilities:{nitrogenField:true}}),route=universe.routes.find(candidate=>candidate.id===NITROGEN_ROUTE.id);assert.ok(route);
  assert.match(svg,/id="layer-nitrogen-field"/);assert.match(svg,new RegExp(`data-progression="post-CHO" data-left="${dynamic.left}" data-right="${dynamic.right}" data-top="${dynamic.top}" data-bottom="${dynamic.bottom}"`));assert.match(svg,/data-developer-only="true"/);assert.match(svg,/Player-facing route belts\/fills are intentionally absent/);
  assert.equal(universe.nitrogenZones.length,NITROGEN_ZONES.length);for(const zone of universe.nitrogenZones)assert.match(svg,new RegExp(`data-nitrogen-zone="${zone.id}"[\\s\\S]*data-zone-width="${fmt(zone.width)}"`));
  assert.equal(universe.nitrogenHazards.length,NITROGEN_HAZARDS.length);for(const hazard of universe.nitrogenHazards)assert.match(svg,new RegExp(`data-nitrogen-hazard="${hazard.id}" data-hazard-type="${hazard.type}" data-hazard-subtype="${hazard.subtype}" data-base-intensity="${fmt(hazard.baseIntensity)}"`));
  assert.match(svg,new RegExp(`data-resource-area="high-density-pocket"[\\s\\S]*cx="${fmt(NITROGEN_HIGH_DENSITY_POCKET.x)}" cy="${fmt(NITROGEN_HIGH_DENSITY_POCKET.y)}"`));for(const area of NITROGEN_RECOVERY_AREAS)assert.match(svg,new RegExp(`data-recovery-area="${area.id}"`));assert.match(svg,new RegExp(`data-critical-insight-area="${NITROGEN_INSIGHT_AREA.id}"`));assert.doesNotMatch(svg,/data-rare-anomaly=/,'retired Rare Survey markers must not appear on the developer map');assert.match(svg,new RegExp(`data-nitrogen-core="${NITROGEN_CORE.id}"[\\s\\S]*data-fracture-radius="${fmt(NITROGEN_CORE.fractureRadius)}"`));
});
test('Nitrogen map extension preserves the locked CHO baseline annotations',()=>{const svg=buildFieldMapSvg();assert.match(svg,/id="playable-bounds"[\s\S]*data-left="-1100" data-right="1250" data-top="-12750" data-bottom="500"/);assert.match(svg,/id="cho-destination" data-radius="95" cx="280" cy="-12470" r="95"/);assert.match(svg,new RegExp(`data-nitrogen-y="${GROWTH.nitrogenY}"`));});
