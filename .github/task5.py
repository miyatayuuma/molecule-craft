from pathlib import Path
import re


def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:180]!r}')
    p.write_text(text.replace(old,new,1))

# Developer map annotations must reflect Task 2's de-farmed route profile. Side is
# still longer, but it is no longer a high-density reward route.
replace('scripts/export-field-map.mjs',
"    'oxygen-shortcut':'low-medium','oxygen-main':'medium-stable','oxygen-side':'high',",
"    'oxygen-shortcut':'low-medium','oxygen-main':'medium-stable','oxygen-side':'medium-long',")

# Remove the superseded pre-Task-2 layout experiment (including eddyAtoms=180).
# The production economy is now locked by stock-level regression instead of a
# historical reward-layout comparison command.
p=Path('scripts/simulate-oxygen-routes.mjs'); text=p.read_text()
updated,count=re.subn(r"\nexport function compareOxygenLayouts\(\)\{.*?\n\}\nexport function evaluateChoDestinations", "\nexport function evaluateChoDestinations", text, count=1, flags=re.S)
if count!=1:
    raise SystemExit('compareOxygenLayouts block not found')
old="const arg=process.argv[2],commands={'--matrix':evaluateOxygenLoadouts,'--final-matrix':evaluateChoDestinations,'--compare-layouts':compareOxygenLayouts,'--controls':()=>OXYGEN_SCENARIOS.map(simulateOxygenRoute),'--case':()=>simulateOxygenRoute(JSON.parse(process.argv[3]))};\n  if(arg&&!commands[arg])throw Error('Use --matrix, --final-matrix, --compare-layouts, --controls, or --case JSON');"
new="const arg=process.argv[2],commands={'--matrix':evaluateOxygenLoadouts,'--final-matrix':evaluateChoDestinations,'--controls':()=>OXYGEN_SCENARIOS.map(simulateOxygenRoute),'--case':()=>simulateOxygenRoute(JSON.parse(process.argv[3]))};\n  if(arg&&!commands[arg])throw Error('Use --matrix, --final-matrix, --controls, or --case JSON');"
if old not in updated:
    raise SystemExit('compare-layouts CLI anchor not found')
p.write_text(updated.replace(old,new,1))

# CHO campaign should not encode an old route-specific harvest hierarchy. The
# campaign contract is destination/return completion; route economy is now owned
# by the dedicated Task 2/Task 5 balance regressions.
replace('tests/cho-campaign.test.mjs',
"const main=simulateOxygenRoute(options),side=simulateOxygenRoute({...options,routeId:'oxygen-side',propellant:'carbon-dioxide'});\nassert.ok(main.reached&&side.reached);assert.ok(main.netByElement.O>side.netByElement.O,'Main eddy rewards oxygen per sortie');assert.ok(side.duration<main.duration,'Side remains the quicker material route');assert.ok(side.netByElement.H>main.netByElement.H,'CO₂ preserves hydrogen');\nconsole.log('CHO campaign: destination, captured/late return, transactional ending, old/future saves, reset, two final loadouts and placement tradeoffs passed.');",
"const sideFinal=simulateOxygenRoute({...options,routeId:'oxygen-side',propellant:'carbon-dioxide',predators:false,destination:'final'});\nassert.ok(sideFinal.reached&&sideFinal.destinationReached&&sideFinal.choCompleted,'Side route must remain a valid path into Deep/CHO');assert.equal(sideFinal.returnType,'voluntary');assert.ok(sideFinal.accountingConsistent);\nconsole.log('CHO campaign: destination, captured/late return, transactional ending, old/future saves, reset, and route-independent CHO completion passed.');")

print('Task 5 stale contracts and developer-map semantics updated')
