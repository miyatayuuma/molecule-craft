import assert from 'node:assert/strict';
import {createRelaxationSession, RELAXATION_POLICY} from '../src/structure-motion.js';
import {createWorkspaceView} from '../src/workspace-view.js';

// No dependency on real wall-clock speed or WebGL for convergence policy tests.
for (const fps of [15,30,60]) {
  let steps=0;
  const solver={step:()=>steps++,measureError:()=>({finite:true,bondRelative:steps<300?.4:0,angleRadians:0,planeDistance:0})};
  const session=createRelaxationSession({solver});let result;
  for(let frame=1;frame<fps*10;frame++) {result=session.advance(frame*1000/fps,{clock:()=>0});if(result.done)break;}
  assert.ok(result.converged);assert.ok(steps>=300&&steps<=330);
}
{
  const solver={step:()=>0,measureError:()=>({finite:true,bondRelative:.5,angleRadians:0,planeDistance:0})};
  const session=createRelaxationSession({solver});let result;
  for(let frame=1;frame<=400;frame++){result=session.advance(frame*1000/60,{clock:()=>0});if(result.done)break;}
  assert.equal(result.steps,RELAXATION_POLICY.maxSteps);
  assert.equal(result.converged,false,'No movement is NOT proof of correct bond lengths');
}
{
  const session=createRelaxationSession({solver:{step:()=>0,measureError:()=>({finite:true,bondRelative:1,angleRadians:0,planeDistance:0})}});
  session.pause(100000);
  assert.equal(session.advance(100000,{clock:()=>0}).steps,0,'No hidden-tab catch-up jump');
}
{
  const a={signature:'a',ids:new Set([1,2]),graph:{atoms:[{id:1,element:'C'},{id:2,element:'C'}]}};
  const b={signature:'b',ids:new Set([3]),graph:{atoms:[{id:3,element:'O'}]}};
  const view=createWorkspaceView(),points=new Map([[1,{x:0,y:0,z:0}],[2,{x:1,y:0,z:0}],[3,{x:40,y:2,z:-20}]]);
  view.select(3);view.frame(b,{x:40,y:2,z:-20});view.select(null);
  assert.equal(view.resolve([a,b],a),b,'Background deselection must preserve focused component');
  assert.deepEqual(view.capture([a,b],a,id=>points.get(id)),{ids:b.ids,center:{x:40,y:2,z:-20}});
  view.select(1);assert.equal(view.resolve([a,b],a),a);
  view.clear();assert.equal(view.resolve([],null),null);
}
console.log('Motion policy tests passed: 15/30/60 FPS, stalled solver, pause and persistent view focus.');
