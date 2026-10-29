import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildFieldExpansionProposalSvg} from '../scripts/export-field-expansion-proposal.mjs';
import {ANCHORS,ROUTES} from '../scripts/field-expansion-proposal-data.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=fileURLToPath(new URL('../scripts/export-field-expansion-proposal.mjs',import.meta.url));
const currentUrl=new URL('../docs/maps/current-field.svg',import.meta.url);
const outputUrl=new URL('../docs/maps/field-expansion-proposal.svg',import.meta.url);
const exporterUrl=new URL('../scripts/export-field-expansion-proposal.mjs',import.meta.url);
const dataUrl=new URL('../scripts/field-expansion-proposal-data.mjs',import.meta.url);
const requiredLayers=[
  'layer-current-reference',
  'layer-proposed-h-revisit','layer-proposed-c-revisit','layer-proposed-oxygen-entry',
  'layer-proposed-oxygen-burst','layer-proposed-oxygen-drive','layer-proposed-oxygen-thermal',
  'layer-proposed-deep-safe','layer-proposed-deep-skill','layer-proposed-deep-thermal',
  'layer-proposed-recovery','layer-proposed-density-h','layer-proposed-density-c','layer-proposed-density-o',
  'layer-proposed-thermal','layer-proposed-gates','layer-proposed-challenges','layer-proposed-signals','layer-proposed-labels',
];
const routeIds=[
  'proposal-h-revisit','proposal-c-revisit','proposal-oxygen-entry','proposal-oxygen-burst','proposal-oxygen-drive',
  'proposal-oxygen-thermal','proposal-deep-safe','proposal-deep-skill','proposal-deep-thermal',
];
const run=(...args)=>spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8'});
const viewBox=svg=>svg.match(/<svg\b[^>]*\bviewBox="([^"]+)"/)?.[1];

test('FIELD expansion proposal is deterministic, complete, and uses the CURRENT map coordinate system',async()=>{
  const current=await readFile(currentUrl,'utf8');
  const first=buildFieldExpansionProposalSvg(current),second=buildFieldExpansionProposalSvg(current);
  assert.equal(first,second);
  assert.equal(viewBox(first),viewBox(current));
  assert.match(first,/href="current-field\.svg"/);
  assert.match(first,/CURRENT REFERENCE/);
  assert.match(first,/PROPOSAL ONLY — not implemented in FIELD gameplay/);
  for(const id of requiredLayers)assert.match(first,new RegExp(`id="${id}"`),id);
  for(const id of routeIds)assert.match(first,new RegExp(`id="${id}"`),id);
  for(const gate of ['G0','G1','G2','G3'])assert.match(first,new RegExp(`${gate} ·`),gate);
  const committed=await readFile(outputUrl,'utf8');
  assert.equal(committed,first);
});

test('design-lock anchors and requested route geometry remain explicit structured data',()=>{
  assert.deepEqual(ANCHORS.oxygenAnchor,{x:170,y:-8090,label:'Oxygen anchor'});
  assert.deepEqual(ANCHORS.oxygenJunction,{x:120,y:-8700,label:'Oxygen junction'});
  assert.deepEqual(ANCHORS.oxygenNetworkMerge,{x:120,y:-10670,label:'Oxygen network merge'});
  assert.deepEqual(ANCHORS.frontierApproach,{x:100,y:-11830,label:'Deep Oxygen exit / Frontier approach'});
  assert.deepEqual(ANCHORS.frontierAnchor,{x:100,y:-11920,label:'Frontier anchor'});
  assert.deepEqual(ANCHORS.choDestination,{x:280,y:-12470,label:'CHO destination'});

  assert.deepEqual(ROUTES.oxygenEntry.points,[[170,-8090],[420,-8300],[420,-8500],[120,-8700]]);
  assert.deepEqual(ROUTES.oxygenBurst.points,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
  assert.deepEqual(ROUTES.oxygenDrive.points,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
  assert.deepEqual(ROUTES.oxygenThermal.points,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
  assert.deepEqual(ROUTES.deepSafe.points,[[120,-10800],[-650,-11000],[-720,-11450],[100,-11830]]);
  assert.deepEqual(ROUTES.deepSkill.points,[[120,-10800],[100,-11200],[100,-11830]]);
  assert.deepEqual(ROUTES.deepThermal.points,[[120,-10800],[760,-11050],[760,-11500],[100,-11830]]);
  assert.deepEqual(ROUTES.hRevisit.points,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  assert.deepEqual(ROUTES.cRevisit.points,[[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]);
});

test('proposal tooling stays outside production FIELD modules',async()=>{
  const [exporter,data]=await Promise.all([readFile(exporterUrl,'utf8'),readFile(dataUrl,'utf8')]);
  assert.doesNotMatch(exporter,/from ['"]\.\.\/src\//);
  assert.doesNotMatch(data,/from ['"]\.\.\/src\//);
  assert.doesNotMatch(exporter,/src\/veil\//);
  assert.doesNotMatch(data,/src\/veil\//);
});

test('exporter CLI writes successfully and --check accepts the committed proposal',()=>{
  const write=run();
  assert.equal(write.status,0,write.stderr||write.stdout);
  assert.match(write.stdout,/Wrote docs\/maps\/field-expansion-proposal\.svg/);
  const check=run('--check');
  assert.equal(check.status,0,check.stderr||check.stdout);
  assert.match(check.stdout,/FIELD expansion proposal map is current/);
});
