import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('navigation uses one stroke language without changing accessible labels',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const symbols=[...html.matchAll(/<symbol id="ui-[\s\S]*?<\/symbol>/g)];
 assert.equal(symbols.length,9);
 for(const [symbol] of symbols){assert.match(symbol,/stroke="currentColor" stroke-width="3.5"/);assert.doesNotMatch(symbol,/(?:stroke|fill)="#[0-9a-f]+"/i);}
 assert.match(html,/id="open-supply"[^>]+aria-label="探索機を開く"/);
 assert.match(html,/id="open-menu"[^>]+aria-label="メニュー"/);
 const supply=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
 assert.doesNotMatch(supply,/accessCanvas|drawAccessIcon/,'the obsolete canvas must not duplicate SVG navigation');
});

test('desktop hardware fills its grid while mobile retains bounded height',async()=>{
 const source=await readFile(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');
 assert.match(source,/height:clamp\(205px,60vw,240px\);/);
 assert.doesNotMatch(source,/height:clamp\(205px,60vw,240px\)!important/);
 assert.match(source,/@media\(min-width:1024px\) and \(min-height:640px\)\{#supply-dialog \.collector-shell-map\{height:100%;/);
 assert.match(source,/shell-port\[data-active=true\]:before\{border:2px solid/);
});

test('launch affordances are decorative and reduced-motion leaves the vessel still',async()=>{
 const [css,supply]=await Promise.all(['../veil.css','../src/veil/supply.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 assert.match(css,/\.loadout-launch-trail\{[^}]*pointer-events:none/);
 assert.match(css,/@media\(prefers-reduced-motion:no-preference\)\{[\s\S]*?animation:loadout-vessel-rest/);
 assert.match(css,/#collector-shell-preview\{animation:none;translate:none\}/);
 assert.match(supply,/launchTrail\.setAttribute\('aria-hidden','true'\)/);
 assert.match(supply,/delete shellMap\.dataset\.launchDragging/);
 assert.match(supply,/setLoadoutFlightCraftTranslation\(shellMap,x,y\)/,'visual trail must follow, not replace, canonical vessel translation');
});
