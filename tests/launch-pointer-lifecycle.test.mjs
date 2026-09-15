import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const resetStart=source.indexOf('function resetLaunchGesture(');
const resetEnd=source.indexOf('function renderLaunchDestinations()',resetStart);
assert.ok(resetStart>=0&&resetEnd>resetStart,'Launch gesture cleanup must be centralized');
const reset=source.slice(resetStart,resetEnd);
assert.match(reset,/const pointer=launchPointer;/,'Cleanup must snapshot the captured pointer before clearing it');
assert.match(reset,/launchPointer=null;launchStart=null;launchDragged=0;/,'Cleanup must restore all pointer tracking fields to idle');
assert.match(reset,/releasePointerCapture\(pointer\)/,'Cleanup must release pointer capture when one was held');
assert.match(reset,/if\(!keepDestinations\)showLaunchDestinations\(false\);/,'Cleanup must close launch selection unless the tap-open behavior is intentionally preserved');
assert.match(reset,/resetLaunchPosition\(\);/,'Cleanup must restore the explorer visual position');
assert.ok(reset.indexOf('launchPointer=null')<reset.indexOf('releasePointerCapture(pointer)'),'Pointer identity must be cleared before releasing capture so a later lostpointercapture is harmless');

assert.match(source,/function requestDestinationLaunch\(id\)\{\s*resetLaunchGesture\(\);if\(!canOpen\(\)\|\|resources\.blocked\)return false;/,'Destination launch intent must return to idle before a blocked or failed application request');
assert.match(source,/function endLaunch\(event,cancel=false\)[\s\S]*?wasOpen=launchTapStartedOpen;resetLaunchGesture\(\{keepDestinations:!cancel&&!id&&wasTap&&!wasOpen\}\);[\s\S]*?if\(wasTap&&wasOpen&&!id\)return;/,'pointerup/pointercancel must preserve drag behavior while a second idle machine tap closes destination mode');
assert.match(source,/if\(id\)requestDestinationLaunch\(id\);/,'Pointer release on a destination must use the same explicit destination request path as destination buttons');
assert.match(source,/launchHandle\.addEventListener\('pointercancel',event=>endLaunch\(event,true\)\)/,'pointercancel must cancel the gesture');
assert.match(source,/if\(launchPointer!==null\|\|launchBusy\|\|requestedDestinationId!==null\|\|resources\.blocked/,'Busy or pending launch state must reject machine pointer toggles');
assert.match(source,/aria-expanded/,'Destination mode must expose its expanded state to keyboard and assistive technology');
assert.match(source,/launchHandle\.addEventListener\('lostpointercapture',event=>\{if\(event\.pointerId===launchPointer\)endLaunch\(event,true\);\}\)/,'lostpointercapture must cancel only the active pointer');
assert.match(source,/dialog\.addEventListener\('close',[\s\S]*?resetLaunchGesture\(\)/,'Closing LOADOUT mid-drag must clear pointer state and capture');
assert.match(source,/q\('open-supply'\)\.addEventListener\('click',[\s\S]*?resetLaunchGesture\(\)/,'Reopening LOADOUT must start from an idle launch gesture');
assert.match(source,/if\(!isExpeditionDestinationAvailable\(resources\.state,destinationId\)\|\|launchBusy\|\|requestedDestinationId!==null\|\|resources\.blocked\|\|!canOpen\(\)\)return false;/,'Canonical destination validity plus pending/busy state must reject duplicate launch requests before transaction handoff');
assert.match(source,/outcome=await onLaunchReady\(destinationId,\{partial,presentSupply:async supply=>\{/,'Confirmed pointer/button launch must hand the explicit destination and committed-supply presenter to the application transaction');
assert.match(source,/if\(outcome===true\|\|outcome\?\.status==='success'\)\{requestedDestinationId=null;if\(dialog\.open\)dialog\.close\(\);return true;\}[\s\S]*?requestedDestinationId=null;[\s\S]*?if\(!resources\.blocked&&canOpen\(\)&&!dialog\.open\)dialog\.showModal\(\);/,'A successful transaction may close LOADOUT after presentation, while a failed or blocked transaction must clear the pending destination and restore retryable LOADOUT');
assert.match(source,/finally\{\s*delete dialog\.dataset\.preserveShellClose;launchBusy=false;/,'Transaction handoff cleanup must release the presentation-preservation flag and launch busy lock');
assert.doesNotMatch(source,/\.dispatchEvent\(new window\.Event\('change'/,'Pointer lifecycle must not synthesize destination change events');
assert.doesNotMatch(source,/#launch-veil[^\n]*\.click\(|q\('launch-veil'\)\.click\(\)/,'Pointer lifecycle must not pseudo-click the launch affordance');

console.log('LOADOUT launch pointer lifecycle passed: pointer, cancellation, retry, dedupe, and explicit transaction handoff are guarded without DOM relay.');
