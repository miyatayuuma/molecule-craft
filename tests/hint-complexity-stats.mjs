import {nextCraftBondHint} from '../src/craft-target-hint.js';
function alkane(n){const atoms=Array(n).fill('C'),bonds=[];for(let i=0;i<n-1;i++)bonds.push([i,i+1,1]);let h=n;for(let i=0;i<n;i++){const count=i===0||i===n-1?3:2;for(let j=0;j<count;j++){atoms.push('H');bonds.push([i,h++,1]);}}return {id:`synthetic-alkane-${n}`,atoms,bonds};}
function workspaceFrom(record){const atoms=record.atoms.map((element,index)=>({id:1000+index,element}));const bonds=record.bonds.slice(0,-1).map(([a,b,order])=>({a:atoms[a].id,b:atoms[b].id,order}));return {atoms,bonds};}
for(const n of [8,10,12,14]){const target=alkane(n),stats={};nextCraftBondHint(target,workspaceFrom(target),{stats});console.log(JSON.stringify({n,atoms:target.atoms.length,...stats}));}
