import assert from 'node:assert/strict';
import {createExpeditionLaunchRequester,isExpeditionDestinationAvailable} from '../src/veil/launch-request.js';

const state={progress:{checkpoint:'carbon',regions:['veil','carbon','oxygen']}};
assert.equal(isExpeditionDestinationAvailable(state,'continue'),true);
assert.equal(isExpeditionDestinationAvailable(state,'oxygen'),true);
assert.equal(isExpeditionDestinationAvailable(state,'frontier'),false);
assert.equal(isExpeditionDestinationAvailable(state,''),false);
assert.equal(isExpeditionDestinationAvailable({},'continue'),false);

{
  const calls=[];
  const requestExpeditionLaunch=createExpeditionLaunchRequester({
    isAvailable:id=>id==='oxygen',
    selectDestination:id=>{calls.push(['select',id]);return true;},
    prepareLaunch:id=>{calls.push(['prepare',id]);return true;},
  });
  assert.equal(requestExpeditionLaunch('oxygen'),true);
  assert.deepEqual(calls,[['select','oxygen'],['prepare','oxygen']]);
  assert.equal(requestExpeditionLaunch('frontier'),false);
  assert.deepEqual(calls,[['select','oxygen'],['prepare','oxygen']],'invalid destinations must not mutate selection or start preparation');
}

{
  const calls=[];
  const requestExpeditionLaunch=createExpeditionLaunchRequester({
    isAvailable:()=>true,
    selectDestination:id=>{calls.push(['select',id]);return false;},
    prepareLaunch:id=>{calls.push(['prepare',id]);return true;},
  });
  assert.equal(requestExpeditionLaunch('veil'),false);
  assert.deepEqual(calls,[['select','veil']],'failed selection must stop before launch preparation');
}

console.log('Launch request contract passed: explicit destination validation, selection, and preparation share one bounded application entrypoint.');
