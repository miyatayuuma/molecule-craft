import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INSIGHT_CATEGORY_COLORS} from '../src/insight-category.js';

const root=new URL('../',import.meta.url);
const [index,ui,renderer,insight,veilCss,insightCss,categoryCss]=await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('src/veil/ui.js',root),'utf8'),
  readFile(new URL('src/veil/renderer.js',root),'utf8'),
  readFile(new URL('src/veil/insight-presentation.js',root),'utf8'),
  readFile(new URL('veil.css',root),'utf8'),
  readFile(new URL('src/veil/insight-presentation.css',root),'utf8'),
  readFile(new URL('src/insight-category.css',root),'utf8'),
]);

assert.match(index,/<div id="veil-status-panel"[^>]*role="status"[^>]*aria-live="polite"/);
assert.doesNotMatch(index,/id="veil-return"|id="veil-to-craft"/,'FIELD has no second return control');
assert.match(index,/<canvas id="veil-canvas"[^>]*aria-label/,'The Collector Shell canvas is the extraction control');
assert.match(veilCss,/\.veil-status-panel\{[^}]*pointer-events:none/,'FIELD status cannot receive pointer input');
assert.doesNotMatch(veilCss,/#veil-return(?:\W|\{)/,'The retired return control has no live FIELD styling');

assert.match(ui,/if\(\(run\.carriedInsights\?\.length\?\?0\)>0\)return 'insight'/);
assert.match(ui,/isInsideSafeExtractionSite\(run\.player,run\.map\.safeExtractionSites\)\?'site':null/);
assert.match(ui,/canvas\.addEventListener\('pointerup',[\s\S]*shipHitRadius[\s\S]*beginReturn\(false\)/,'Normal extraction input is hit-tested against the Collector Shell');
assert.match(ui,/document\.activeElement===canvas/,'Keyboard activation belongs to the focused ship control');
assert.match(ui,/phase:'normal-extraction-pending',source:method,duration:EXPEDITION\.normalExtractionSeconds/);
assert.match(ui,/captured\?'forced-warp-pending':'normal-warp-pending'/,'Settlements wait for the terminal warp phase');
assert.match(ui,/q\('veil-heat'\)\.textContent='POWER'/);

assert.match(insight,/make\(doc,'span','veil-insight-ready'\)/);
assert.match(insight,/make\(doc,'span','veil-normal-insight insight-bulb'\)/);
assert.doesNotMatch(insight,/onExtract|addEventListener\('click'/,'Insight bulbs are visual state markers, not independent controls');
assert.match(insightCss,/\.veil-insight-ready\{[^}]*background:transparent[^}]*box-shadow:none/);
assert.match(insightCss,/\.veil-normal-insight\{width:26px;height:26px/,'Held Insight stays clearly visible after the brief ready emphasis');
assert.match(categoryCss,/\.insight-bulb\{[^}]*background:var\(--insight-category-color/);
for(const color of Object.values(INSIGHT_CATEGORY_COLORS))assert.ok(categoryCss.includes(color),`CSS keeps category color ${color}`);
assert.match(renderer,/category,color:INSIGHT_CATEGORY_COLORS\[category\]/,'Released Insight preserves its held category color');
assert.match(renderer,/drawInsightBulb\(at\.x,at\.y,size,particle\.color/,'Loss fades and moves the same bulb instead of recoloring it');
assert.match(renderer,/nearestSite=!carryingInsight\?\[\.\.\.sites\]\.sort/,'The nearest authored site is discoverable before extraction becomes available');
assert.match(renderer,/if\(arrowTarget&&\(/,'An offscreen Safe Site remains indicated while the player is seeking extraction');

console.log('FIELD return UX contract passed: ship-only extraction, noninteractive status, POWER HUD, persistent category-colored Insight and phased settlement.');
