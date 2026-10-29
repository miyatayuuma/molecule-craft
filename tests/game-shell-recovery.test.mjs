import test from 'node:test';
import assert from 'node:assert/strict';

function node(id=''){
  return {id,open:false,style:{},listeners:new Map(),addEventListener(type,fn){this.listeners.set(type,fn);},removeAttribute(){},querySelector(){return null;},matches(){return false;},remove(){},showModal(){this.open=true;},close(){this.open=false;},click(){this.listeners.get('click')?.({target:this});}};
}

const menuButton=node('open-menu'),infoButton=node('open-info'),menu=node('menu-dialog'),info=node('info-dialog');
const byId=new Map([[menuButton.id,menuButton],[infoButton.id,infoButton],[menu.id,menu],[info.id,info]]);
globalThis.document={getElementById:id=>byId.get(id)??null,querySelector(selector){return selector.startsWith('#')?(byId.get(selector.slice(1))??null):null;},querySelectorAll(selector){return selector==='dialog.sheet'?[menu,info]:[];}};
const {createGameShell}=await import('../src/game-shell.js?recovery-test=1');

test('menu is a recovery escape hatch for transient CRAFT locks',()=>{
  let locked=true,recoveries=0;createGameShell({canOpen:()=>!locked,onBlockedMenuOpen:()=>{recoveries++;locked=false;}});menuButton.click();assert.equal(recoveries,1);assert.equal(menu.open,true);
});

test('non-menu sheets do not bypass the CRAFT interaction lock',()=>{
  menu.open=false;info.open=false;let recoveries=0;createGameShell({canOpen:()=>false,onBlockedMenuOpen:()=>{recoveries++;}});infoButton.click();assert.equal(recoveries,0);assert.equal(info.open,false);
});
