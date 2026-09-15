import fs from 'node:fs';
const path='tests/encyclopedia-transition-browser.test.mjs';
let text=fs.readFileSync(path,'utf8');
const from="inside=(x,y,r)=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom";
const to="inside=(x,y,r)=>Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2))<Math.min(r.width,r.height)/2";
const count=text.split(from).length-1;
if(count!==1)throw new Error(`mobile circle check: expected one match, got ${count}`);
fs.writeFileSync(path,text.replace(from,to));
