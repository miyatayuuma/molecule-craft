from pathlib import Path

path=Path('tests/craft-controls-ui.test.mjs')
text=path.read_text()
old="""  const undo=node('undo-cleanup'),clear=node('clear-all'),actions=node('actions'),palette=node('palette'),focus=node('structure-focus'),viewer=node('viewer'),canvas=node('canvas'),windowListeners=new Map(),documentListeners=new Map();
  actions.insertBefore=()=>{};
  const document={hidden:false,defaultView:{addEventListener(type,fn){windowListeners.set(type,fn);}},querySelector(selector){if(selector==='.viewer-actions')return actions;if(selector==='#undo-cleanup')return undo;if(selector==='#clear-all')return clear;return null;},querySelectorAll(){return[];},addEventListener(type,fn){documentListeners.set(type,fn);}};
"""
new="""  const undo=node('undo-cleanup'),clear=node('clear-all'),actions=node('actions'),palette=node('palette'),focus=node('structure-focus'),viewer=node('viewer'),canvas=node('canvas'),windowListeners=new Map(),documentListeners=new Map();
  actions.insertBefore=()=>{};
  const add=(map,type,fn)=>{const list=map.get(type)??[];list.push(fn);map.set(type,list);};
  const document={hidden:false,defaultView:{addEventListener(type,fn){add(windowListeners,type,fn);}},querySelector(selector){if(selector==='.viewer-actions')return actions;if(selector==='#undo-cleanup')return undo;if(selector==='#clear-all')return clear;return null;},querySelectorAll(){return[];},addEventListener(type,fn){add(documentListeners,type,fn);}};
"""
if old not in text: raise SystemExit('listener fixture source not found')
text=text.replace(old,new,1)
text=text.replace("  windowListeners.get('blur')();assert.equal(interrupted,1);\n  document.hidden=true;documentListeners.get('visibilitychange')();assert.equal(visibility,1);assert.equal(interrupted,2);\n  document.hidden=false;documentListeners.get('visibilitychange')();assert.equal(visibility,2);assert.equal(interrupted,2,'foreground visibility change is not an interruption');",
"  for(const fn of windowListeners.get('blur')??[])fn();assert.equal(interrupted,1);\n  document.hidden=true;for(const fn of documentListeners.get('visibilitychange')??[])fn();assert.equal(visibility,1);assert.equal(interrupted,2);\n  document.hidden=false;for(const fn of documentListeners.get('visibilitychange')??[])fn();assert.equal(visibility,2);assert.equal(interrupted,2,'foreground visibility change is not an interruption');",1)
path.write_text(text)
Path('scripts/fix-craft-input-test-fixture.py').unlink(missing_ok=True)
