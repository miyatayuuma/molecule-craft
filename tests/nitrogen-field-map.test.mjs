import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';
import {createUniverse} from '../src/veil/universe.js';
import {GROWTH,flightConfig} from '../src/veil/growth.js';
import {NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_PULSES,NITROGEN_RARE_CL_SITE,NITROGEN_RECOVERY_AREA,NITROGEN_ROUTE,NITROGEN_ZONES} from '../src/veil/nitrogen-routes.js';

const fmt=value=>String(Math.round(value*1000)/1000).replace(/^-0$/,'0');
const pointPath=points=>`M ${points.map(point=>`${fmt(point.x)} ${fmt(point.y)}`).join(' L ')}`;
const escapeRegex=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

test('Current FIELD map derives completed Nitrogen chapter layers from production geometry',()=>{
  const svg=buildFieldMapSvg(),dynamic=flightConfig({progress:{choCompleted:true},elements:{N:0}}).bounds,universe=createUniverse(1,{H:0,C:0,N:0,O:0},{capabilities:{nitrogenField:true}}),route=universe.routes.find(candidate=>candidate.id===NITROGEN_ROUTE.id);assert.ok(route);
  assert.match(svg,/id="layer-nitrogen-field"/);assert.match(svg,new RegExp(`id="dynamic-boundary"[\\s\\S]*data-progression="post-CHO" data-left="${dynamic.left}" data-right="${dynamic.right}" data-top="${dynamic.top}" data-bottom="${dynamic.bottom}"`));
  assert.match(svg,new RegExp(`id="route-${NITROGEN_ROUTE.id}" data-route="${NITROGEN_ROUTE.id}" data-element="N" d="${escapeRegex(pointPath(route.points))}"`));
  assert.equal(universe.nitrogenZones.length,NITROGEN_ZONES.length);for(const zone of universe.nitrogenZones){assert.match(svg,new RegExp(`data-nitrogen-zone="${zone.id}" data-zone-kind="${zone.kind}" data-zone-width="${fmt(zone.width)}" d="${escapeRegex(pointPath(zone.points))}"`));}
  const pulses=universe.fields.filter(field=>field.kind==='nitrogen-pulse');assert.equal(pulses.length,NITROGEN_PULSES.length);for(const pulse of pulses)assert.match(svg,new RegExp(`data-nitrogen-pulse="${pulse.id}" data-force="${fmt(pulse.force)}" data-angle="${escapeRegex(fmt(pulse.angle))}" data-optional="${pulse.optional===true}" cx="${fmt(pulse.x)}" cy="${fmt(pulse.y)}" r="${fmt(pulse.radius)}"`));
  const main=universe.dust.filter(item=>item.element==='N'&&item.route===NITROGEN_ROUTE.id),pocket=universe.dust.filter(item=>item.element==='N'&&item.route===NITROGEN_HIGH_DENSITY_POCKET.id);assert.match(svg,new RegExp(`data-resource-area="mainline" data-count="${main.length}"`));assert.match(svg,new RegExp(`data-resource-area="high-density-pocket"[\\s\\S]*cx="${fmt(NITROGEN_HIGH_DENSITY_POCKET.x)}" cy="${fmt(NITROGEN_HIGH_DENSITY_POCKET.y)}" r="${fmt(NITROGEN_HIGH_DENSITY_POCKET.radius)}"`));assert.match(svg,new RegExp(`data-resource-area="high-density-pocket-particles" data-count="${pocket.length}"`));
  assert.match(svg,new RegExp(`data-recovery-area="${NITROGEN_RECOVERY_AREA.id}" cx="${fmt(NITROGEN_RECOVERY_AREA.x)}" cy="${fmt(NITROGEN_RECOVERY_AREA.y)}" r="${fmt(NITROGEN_RECOVERY_AREA.radius)}"`));assert.match(svg,new RegExp(`data-critical-insight-area="${NITROGEN_INSIGHT_AREA.id}" cx="${fmt(NITROGEN_INSIGHT_AREA.x)}" cy="${fmt(NITROGEN_INSIGHT_AREA.y)}" r="${fmt(NITROGEN_INSIGHT_AREA.radius)}"`));assert.match(svg,new RegExp(`data-rare-anomaly="${NITROGEN_RARE_CL_SITE.id}" data-element="Cl" cx="${fmt(NITROGEN_RARE_CL_SITE.x)}" cy="${fmt(NITROGEN_RARE_CL_SITE.y)}"`));
});

test('Nitrogen map extension preserves the locked CHO baseline annotations',()=>{const svg=buildFieldMapSvg();assert.match(svg,/id="playable-bounds"[\s\S]*data-left="-1100" data-right="1250" data-top="-12750" data-bottom="500"/);assert.match(svg,/id="cho-destination" data-radius="95" cx="280" cy="-12470" r="95"/);assert.match(svg,new RegExp(`data-nitrogen-y="${GROWTH.nitrogenY}"`));});
