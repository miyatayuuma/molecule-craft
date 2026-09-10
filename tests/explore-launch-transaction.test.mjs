import assert from 'node:assert/strict';
import test from 'node:test';
import {runLaunchTransaction} from '../src/veil/launch-transaction.js';
import {createUIStateCoordinator,UI_MODE} from '../src/ui-state.js';

function fixture(){
  const listeners=new Map();
  const dialog=id=>({id,open:false,showModal(){this.open=true;},close(){this.open=false;for(const fn of listeners.get(id)??[])fn();},addEventListener(type,fn){if(type==='close'){const rows=listeners.get(id)??[];rows.push(fn);listeners.set(id,rows);}}});
  const nodes={'veil-view':{hidden:true},'supply-dialog':dialog('supply-dialog'),'collection-dialog':dialog('collection-dialog'),'menu-dialog':dialog('menu-dialog')};
  const appShell={inert:false},body={dataset:{mode:'craft'}};
  const root={body,getElementById:id=>nodes[id]??null,querySelector(selector){if(selector==='.app-shell')return appShell;if(selector.startsWith('#'))return nodes[selector.slice(1)]??null;return null;}};
  return{root,nodes,appShell,body};
}

function assertLoadout(fx,ui){
  assert.equal(ui.mode,UI_MODE.LOADOUT);assert.equal(fx.nodes['supply-dialog'].open,true);assert.equal(fx.nodes['veil-view'].hidden,true);assert.equal(fx.appShell.inert,false);assert.equal(fx.body.dataset.mode,'craft');
}

const phases=['createRun','createRenderer','resizeRenderer','resetRenderer','startAudio','prepareHud','updatePrompt','initialDraw','saveLaunch'];
for(const failAt of phases)test(`failure during ${failAt} rolls back to operable LOADOUT`,()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root),runtime={active:false,run:null,raf:0,runs:4,resourceFill:17};ui.transition(UI_MODE.LOADOUT);
  const previousRuns=runtime.runs;
  const steps=phases.map(name=>({name,run(){if(name==='createRun')runtime.run={id:'run'};if(name==='updatePrompt')runtime.active=true;if(name==='saveLaunch')runtime.runs=previousRuns+1;if(name===failAt)throw Error(name);}}));
  const result=runLaunchTransaction({steps,commit(){ui.transition(UI_MODE.EXPLORE);runtime.raf=1;},rollback(error,phase){assert.equal(phase,failAt);runtime.active=false;runtime.run=null;runtime.raf=0;runtime.runs=previousRuns;ui.transition(UI_MODE.LOADOUT);}});
  assert.equal(result,false);assert.equal(runtime.active,false);assert.equal(runtime.run,null);assert.equal(runtime.raf,0);assert.equal(runtime.runs,previousRuns);assert.equal(runtime.resourceFill,17,'committed loadout resources are intentionally not rolled back');assertLoadout(fx,ui);
});

test('EXPLORE commits only after initial draw and save, and retry succeeds',()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root),order=[];ui.transition(UI_MODE.LOADOUT);
  const execute=failDraw=>runLaunchTransaction({steps:[
    {name:'createRun',run:()=>order.push('createRun')},
    {name:'initialDraw',run:()=>{order.push('initialDraw');if(failDraw)throw Error('draw');}},
    {name:'saveLaunch',run:()=>order.push('saveLaunch')},
  ],commit(){order.push('commit');ui.transition(UI_MODE.EXPLORE);},rollback(){order.push('rollback');ui.transition(UI_MODE.LOADOUT);}});
  assert.equal(execute(true),false);assertLoadout(fx,ui);
  order.length=0;assert.equal(execute(false),true);assert.deepEqual(order,['createRun','initialDraw','saveLaunch','commit']);assert.equal(ui.mode,UI_MODE.EXPLORE);assert.equal(fx.nodes['veil-view'].hidden,false);assert.equal(fx.appShell.inert,true);
});
