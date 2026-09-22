import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {readFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {LOADOUT_DESIGN,LOADOUT_HARDWARE_LAYOUT,LOADOUT_SLOT_USES} from '../src/veil/loadout-hardware-layout.js';
import {MOLECULE_ROLE_PROFILES} from '../src/veil/molecule-roles.js';

const root=new URL('../',import.meta.url),source=await readFile(new URL('assets/loadout-v2/loadout-hardware-master.jpg',root));
const sha=createHash('sha256').update(source).digest('hex');
assert.equal(sha,'03c2350c664d23c1446293e35fd504e3724a732e792f79adbf65d6040ec086ea','approved LOADOUT master must remain byte-identical');

function pngInfo(bytes){
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);let offset=8,width=0,height=0,colorType=0,compressed=[];
  while(offset<bytes.length){const length=bytes.readUInt32BE(offset);const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);offset+=12+length;if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);colorType=data[9];}if(type==='IDAT')compressed.push(data);if(type==='IEND')break;}
  const raw=inflateSync(Buffer.concat(compressed)),bpp=colorType===6?4:colorType===2?3:0;assert.ok(bpp,'assets must use RGB/RGBA PNGs');const stride=width*bpp,alpha=[];let cursor=0,previous=Buffer.alloc(stride);
  for(let y=0;y<height;y++){const filter=raw[cursor++],row=Buffer.from(raw.subarray(cursor,cursor+stride));cursor+=stride;for(let x=0;x<stride;x++){const left=x>=bpp?row[x-bpp]:0,up=previous[x],upleft=x>=bpp?previous[x-bpp]:0;if(filter===1)row[x]=(row[x]+left)&255;else if(filter===2)row[x]=(row[x]+up)&255;else if(filter===3)row[x]=(row[x]+Math.floor((left+up)/2))&255;else if(filter===4){const p=left+up-upleft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upleft);row[x]=(row[x]+(pa<=pb&&pa<=pc?left:pb<=pc?up:upleft))&255;}}if(colorType===6)for(let x=3;x<stride;x+=4)alpha.push(row[x]);previous=row;}
  return {width,height,colorType,alpha};
}

const expected={'loadout-pulse-unit.png':[467,291],'loadout-craft.png':[390,271],'loadout-shock-unit.png':[235,299],'loadout-drive-unit.png':[729,380]};
for(const [name,[width,height]] of Object.entries(expected)){
  const info=pngInfo(await readFile(new URL(`assets/loadout-v2/${name}`,root)));
  assert.deepEqual([info.width,info.height],[width,height],name);assert.equal(info.colorType,6,`${name} must retain an alpha channel`);assert.ok(info.alpha.some(value=>value===0),`${name} must have transparent background`);assert.ok(info.alpha.some(value=>value>0),`${name} must not be empty`);
}

const {design,modules,slots}=LOADOUT_HARDWARE_LAYOUT;
assert.deepEqual(design,{width:1000,height:600,sourceWidth:1536,sourceHeight:921});
const inside=rect=>rect.x>=0&&rect.y>=0&&rect.x+rect.width<=design.width&&rect.y+rect.height<=design.height&&rect.width>0&&rect.height>0;
for(const module of Object.values(modules))assert.ok(inside(module.rect),'module rect must stay inside design space');
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const center=rectangle=>({x:rectangle.x+rectangle.width/2,y:rectangle.y+rectangle.height/2});
for(const [use,slot] of Object.entries(slots)){
  for(const key of ['panelRect','visualRect','hitRect','thumbnailRect','meterRect'])assert.ok(inside(slot[key]),`${use}.${key} must stay inside design space`);
  const panelCenter=center(slot.panelRect),visualCenter=center(slot.visualRect);assert.ok(Math.abs(visualCenter.x-panelCenter.x)<0.01&&Math.abs(visualCenter.y-panelCenter.y)<0.01,`${use} visualRect must remain centered on panelRect`);
  const thumbnailCenter=center(slot.thumbnailRect);assert.ok(Math.abs(thumbnailCenter.x-panelCenter.x)<0.01&&Math.abs(thumbnailCenter.y-panelCenter.y)<0.01,`${use} thumbnailRect must remain centered on panelRect`);
  assert.ok(slot.thumbnailRect.x>=slot.panelRect.x&&slot.thumbnailRect.y>=slot.panelRect.y&&slot.thumbnailRect.x+slot.thumbnailRect.width<=slot.panelRect.x+slot.panelRect.width&&slot.thumbnailRect.y+slot.thumbnailRect.height<=slot.panelRect.y+slot.panelRect.height,`${use} thumbnail must remain inside measured panel`);
  const meterCenter=center(slot.meterRect);assert.ok(Math.abs(meterCenter.x-panelCenter.x)<0.01,`${use} meter must share panel center`);assert.ok(slot.meterRect.y<slot.panelRect.y+slot.panelRect.height+1,`${use} meter must remain tied to panel bottom`);
  assert.ok(slot.thumbnailRect.x>=slot.visualRect.x&&slot.thumbnailRect.y>=slot.visualRect.y&&slot.thumbnailRect.x+slot.thumbnailRect.width<=slot.visualRect.x+slot.visualRect.width&&slot.thumbnailRect.y+slot.thumbnailRect.height<=slot.visualRect.y+slot.visualRect.height,`${use} thumbnail must remain inside visual panel`);
  assert.ok(slot.labelAnchor.x>=0&&slot.labelAnchor.x<=design.width&&slot.labelAnchor.y>=0&&slot.labelAnchor.y<=design.height,`${use} label anchor`);
}
const measured=LOADOUT_HARDWARE_LAYOUT.measuredPanelSourceRects;
assert.deepEqual(Object.keys(measured).sort(),['coolant','fuel','oxidizer','propellant','shock']);
assert.notDeepEqual(measured.fuel.rect,measured.oxidizer.rect,'DRIVE FUEL and O₂ panels must be independently measured');
assert.notDeepEqual(measured.oxidizer.rect,measured.coolant.rect,'DRIVE O₂ and COOLANT panels must be independently measured');
const driveCenters=['fuel','oxidizer','coolant'].map(use=>center(slots[use].panelRect));
const leftDriveGap=driveCenters[1].x-driveCenters[0].x;
const rightDriveGap=driveCenters[2].x-driveCenters[1].x;
assert.ok(Math.abs(leftDriveGap-rightDriveGap)>0.1,'DRIVE panel centers must preserve independently measured spacing');
for(let i=0;i<LOADOUT_SLOT_USES.length;i++)for(let j=i+1;j<LOADOUT_SLOT_USES.length;j++)assert.equal(overlap(slots[LOADOUT_SLOT_USES[i]].hitRect,slots[LOADOUT_SLOT_USES[j]].hitRect),false,`${LOADOUT_SLOT_USES[i]} and ${LOADOUT_SLOT_USES[j]} hit areas must not overlap`);
assert.ok(modules.craft.intakeAnchor.x>=0&&modules.craft.intakeAnchor.y>=0&&modules.craft.intakeAnchor.x<=design.width&&modules.craft.intakeAnchor.y<=design.height);
assert.deepEqual(modules.craft.dragAnchor,{x:412,y:334.5});assert.ok(modules.craft.dragHitRect.width>=160&&modules.craft.dragHitRect.height>=160,'CRAFT drag target must cover the visible body');
assert.deepEqual(modules.craft.connectors.receivingSockets,['left','right','upper']);assert.deepEqual(modules.pulse.connectors.moduleSide,['right']);assert.deepEqual(modules.shock.connectors.moduleSide,['lower']);assert.deepEqual(modules.drive.connectors.moduleSide,['left']);

const workstation=await readFile(new URL('src/veil/loadout-workstation.js',root),'utf8');
assert.match(workstation,/assets\/loadout-v2/);assert.match(workstation,/loadout-craft-image/);assert.match(workstation,/syncLoadoutHardwareLayout/);assert.match(workstation,/setLoadoutCraftTranslation/);assert.doesNotMatch(workstation,/width:145%|width:175%/);assert.match(workstation,/loadout-craft-drag-left/,'launch handle must follow the visible CRAFT body anchor');assert.match(workstation,/for\(const kind of \['drive'\]\)/,'PULSE and SHOCK must not receive duplicate module labels');assert.match(workstation,/background:#a7e2eb!important/,'DRIVE meters must use the shared cyan accent');
for(const id of Object.keys(MOLECULE_ROLE_PROFILES))await access(new URL(`assets/models/molecule-${id}.svg`,root),constants.R_OK);
for(const id of ['nitromethane','2-4-6-trinitrotoluene'])await access(new URL(`assets/models/molecule-${id}.svg`,root),constants.R_OK);
console.log('LOADOUT v2 assets, metadata, connector ownership, alpha matte and active tank thumbnails passed.');
