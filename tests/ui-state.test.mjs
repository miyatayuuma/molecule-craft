import assert from 'node:assert/strict';
import test from 'node:test';
import {createUIStateCoordinator,UI_MODE} from '../src/ui-state.js';

function fixture(){
  const listeners=new Map();
  const dialog=id=>({id,open:false,showModal(){this.open=true;},close(){this.open=false;for(const fn of listeners.get(id)??[])fn();},addEventListener(type,fn){if(type==='close'){const rows=listeners.get(id)??[];rows.push(fn);listeners.set(id,rows);}}});
  const nodes={
    'veil-view':{hidden:true},
    'supply-dialog':dialog('supply-dialog'),
    'collection-dialog':dialog('collection-dialog'),
    'menu-dialog':dialog('menu-dialog'),
  };
  const appShell={inert:false},body={dataset:{mode:'craft'}};
  const root={body,getElementById:id=>nodes[id]??null,querySelector(selector){if(selector==='.app-shell')return appShell;if(selector.startsWith('#'))return nodes[selector.slice(1)]??null;return null;}};
  return{root,nodes,appShell,body};
}

function assertMode(fx,mode){
  const explore=mode===UI_MODE.EXPLORE;
  assert.equal(fx.nodes['veil-view'].hidden,!explore);
  assert.equal(fx.appShell.inert,explore);
  assert.equal(fx.body.dataset.mode,explore?'veil':'craft');
  assert.equal(fx.nodes['supply-dialog'].open,mode===UI_MODE.LOADOUT);
  assert.equal(fx.nodes['collection-dialog'].open,mode===UI_MODE.COLLECTION);
  assert.equal(fx.nodes['menu-dialog'].open,mode===UI_MODE.MENU);
}

test('coordinator owns final primary-mode DOM invariants',()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root);
  for(const mode of [UI_MODE.CRAFT,UI_MODE.LOADOUT,UI_MODE.CRAFT,UI_MODE.COLLECTION,UI_MODE.CRAFT,UI_MODE.MENU,UI_MODE.CRAFT,UI_MODE.EXPLORE,UI_MODE.CRAFT]){
    ui.transition(mode);assert.equal(ui.mode,mode);assertMode(fx,mode);
  }
});

test('primary dialogs are mutually exclusive',()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root);
  ui.transition(UI_MODE.LOADOUT);ui.transition(UI_MODE.COLLECTION);assertMode(fx,UI_MODE.COLLECTION);
  ui.transition(UI_MODE.MENU);assertMode(fx,UI_MODE.MENU);
  ui.transition(UI_MODE.LOADOUT);assertMode(fx,UI_MODE.LOADOUT);
});

test('legacy direct dialog changes are adopted and normalized',()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root);
  fx.nodes['supply-dialog'].open=true;fx.nodes['collection-dialog'].open=true;
  ui.syncFromDom();
  assert.equal(ui.mode,UI_MODE.LOADOUT);
  assertMode(fx,UI_MODE.LOADOUT);
});

test('legacy exploration DOM changes are adopted as EXPLORE',()=>{
  const fx=fixture(),ui=createUIStateCoordinator(fx.root);
  fx.nodes['veil-view'].hidden=false;fx.body.dataset.mode='veil';fx.appShell.inert=true;fx.nodes['menu-dialog'].open=true;
  ui.syncFromDom();
  assert.equal(ui.mode,UI_MODE.EXPLORE);
  assertMode(fx,UI_MODE.EXPLORE);
});
