import test from 'node:test';
import assert from 'node:assert/strict';
import {playReactionStarCeremony} from '../src/reaction-encyclopedia.js';

test('ending a multi-tag star ceremony early restores all awarded stars and settles only once',()=>{
  const originalDocument=globalThis.document;
  const element=()=>({
    dataset:{},style:{},classList:{add(){},remove(){}},
    setAttribute(){},append(){},replaceChildren(){},scrollIntoView(){},
  });
  globalThis.document={createElementNS:element,createElement:element};
  try{
    const cards=['hydrolysis','esterification'].map(tag=>{
      const stars=element();stars.dataset={done:'1',total:'4'};
      return{dataset:{reactionGroup:tag},classList:{add(){},remove(){}},scrollIntoView(){},querySelector:()=>stars,stars};
    });
    const host={querySelectorAll:()=>cards},outcomes=[];
    const runner=playReactionStarCeremony({host,tags:['hydrolysis','esterification'],onSettled:result=>outcomes.push(result.status)});
    assert.deepEqual(cards.map(card=>card.stars.dataset.done),['0','0'],'the newly earned stars begin hidden');
    runner.finish();
    assert.deepEqual(cards.map(card=>card.stars.dataset.done),['1','1'],'skip restores stars in all categories');
    assert.deepEqual(outcomes,['presented']);
    assert.equal(runner.advance(),false,'the completed ceremony cannot advance again');
    runner.finish();
    assert.deepEqual(outcomes,['presented'],'close is idempotent');
  }finally{globalThis.document=originalDocument;}
});
