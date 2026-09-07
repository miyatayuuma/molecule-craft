import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function runtimeText(dir='src'){
  let out='';
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out+=runtimeText(file);
    else if(/\.js$/.test(entry.name))out+=fs.readFileSync(file,'utf8');
  }
  return out;
}

test('all craft entry points use the molecule emblem instead of hammer glyphs',()=>{
  const index=fs.readFileSync('index.html','utf8');
  const source=runtimeText();
  assert.equal((index+source).includes('⚒'),false);
  assert.match(index,/id="tank-craft-molecule"[^>]*craft-emblem-action/);
  assert.match(index,/id="cho-goal-action"[^>]*craft-emblem-action/);
  assert.match(index,/id="veil-to-craft"[^>]*craft-emblem-action/);
  assert.match(index,/id="cho-goal-label"/);
  assert.match(index,/id="veil-to-craft-label"/);
});
