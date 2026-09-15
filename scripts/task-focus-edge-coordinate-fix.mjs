import fs from 'node:fs';
const path='src/encyclopedia-graph-view.js';
let text=fs.readFileSync(path,'utf8');
const from=`  const rect=host.getBoundingClientRect?.()??{width:0};const width=Math.max(320,Math.min(720,rect.width||host.clientWidth||360)),height=Math.max(370,Math.min(560,win?.innerHeight?win.innerHeight*.58:480));`;
const to=`  const rect=host.getBoundingClientRect?.()??{width:0},surfaceWidth=rect.width||host.clientWidth||360;const width=Math.max(240,surfaceWidth-2),height=Math.max(370,Math.min(560,win?.innerHeight?win.innerHeight*.58:480));`;
const count=text.split(from).length-1;
if(count!==1)throw new Error(`graph coordinate width fix: expected one match, got ${count}`);
fs.writeFileSync(path,text.replace(from,to));
