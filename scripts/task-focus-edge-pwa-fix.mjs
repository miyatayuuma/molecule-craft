import fs from 'node:fs';
const viewPath='src/encyclopedia-graph-view.js';
let view=fs.readFileSync(viewPath,'utf8');
const from="'data-edge-from':edge.from,'data-edge-to':edge.to";
const to="'data-edge-source':edge.from,'data-edge-target':edge.to";
const count=view.split(from).length-1;
if(count!==1)throw new Error(`Chevron diagnostic attributes: expected one match, got ${count}`);
fs.writeFileSync(viewPath,view.replace(from,to));

const browserPath='tests/encyclopedia-transition-browser.test.mjs';
let browser=fs.readFileSync(browserPath,'utf8');
browser=browser.replaceAll('dataset.edgeFrom','dataset.edgeSource').replaceAll('dataset.edgeTo','dataset.edgeTarget');
fs.writeFileSync(browserPath,browser);
