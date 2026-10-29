import assert from 'node:assert/strict';
import {createDeferredExplorationFacade} from '../src/craft-connections.js';
import {createExpeditionLaunchRequester,isExpeditionDestinationAvailable} from '../src/veil/launch-request.js';

const state={progress:{checkpoint:'carbon',regions:['veil','carbon','oxygen','frontier']}};
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

{
  let current=null;const calls=[],facade=createDeferredExplorationFacade(()=>current,Promise.resolve(null));
  assert.equal(facade.requestExpeditionLaunch('oxygen'),false,'DB-not-ready facade must preserve the existing blocked launch behavior');
  current={requestExpeditionLaunch:id=>{calls.push(id);return true;}};
  assert.equal(facade.requestExpeditionLaunch('oxygen'),true);
  assert.deepEqual(calls,['oxygen'],'DB-ready facade must forward the explicit destination id to the application launch API');
}

console.log('Launch request contract passed: explicit destination validation, DB-ready gating, selection, and preparation share one bounded application entrypoint.');
