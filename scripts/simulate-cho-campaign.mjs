import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js';
import {installEmptyDeparturePolicy} from '../src/craft-connections.js?v=1';
import {createResources} from '../src/veil/resources.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {REGIONS,flightConfig} from '../src/veil/growth.js';
import {CHO_DESTINATION} from '../src/veil/cho-campaign.js';
import {EXPEDITION} from '../src/veil/config.js';

// Autonomous mechanics playthrough, not a measurement of human crafting time.
export async function simulateChoCampaign({seed=1,propellant='hydrogen',fps=60}={}){
  if(!['hydrogen','carbon-dioxide'].includes(propellant)||![30,60].includes(fps)||!Number.isInteger(seed))throw Error('Invalid campaign simulation options');
  const catalog=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));setMoleculeDatabase(catalog);
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const resources=createResources({storage});resources.setCatalog(catalog);installEmptyDeparturePolicy(resources);const sorties=[],crafts=[];
  function craft(id){
    if(resources.state.recipes.includes(id))return;
    const record=catalog.find(r=>r.id===id),cost=resources.costFor(id);if(!resources.spend(cost))throw Error(`Cannot craft ${id}`);
    const molecule=new Molecule(),ids=record.atoms.map(el=>molecule.addAtom(el).id);
    for(const [a,b,n]of record.bonds)molecule.setBond(ids[a],ids[b],n);
    const built=connectedStructures(molecule)[0];if(!built.complete||built.record?.id!==id)throw Error(`Unrecognized ${id}`);
    if(!resources.discover(id))throw Error(`Cannot discover ${id}`);
    resources.refund(cost); // dismantle the proof model; LOADOUT synthesis happens only at launch
    if(!resources.save())throw Error(`Cannot save ${id} discovery`);crafts.push(id);
  }
  function select(use,id){
    if(!resources.state.recipes.includes(id)||!resources.setLoadoutTank(use,id))throw Error(`Cannot select ${id} for ${use}`);
  }
  function prepareLaunch(){
    const plan=resources.launchFillPlan({includeWorkspace:false}),result=resources.commitLaunchFill({partial:plan.status==='PARTIAL'});
    if(!result)throw Error(`Cannot commit ${plan.status} LOADOUT`);return result;
  }
  function sortie({name,start='veil',routes=[],seconds=65,burn=false,stop=()=>false,final=false}){
    const launch=prepareLaunch();
    const run=createRun(createUniverse(seed+sorties.length,resources.state.elements),flightConfig(),{fuel:resources.prepareExpedition()});Object.assign(run.player,REGIONS[start],{vx:0,vy:0});run.region=start;
    const points=routes.flatMap(id=>run.map.routes.find(r=>r.id===id).points);if(final)points.push(CHO_DESTINATION);
    let index=0;for(let i=1;i<points.length;i++)if(Math.hypot(points[i].x-run.player.x,points[i].y-run.player.y)<Math.hypot(points[index].x-run.player.x,points[index].y-run.player.y))index=i;
    let lock=0,returning=false;
    const systems={consumeCombustion:()=>resources.consumeCombustion(),consumeCoolant:(amount,id)=>resources.consumeTank('coolant',id,amount)};
    for(let frame=0;frame<seconds*fps&&!run.captured;frame++){
      const p=run.player;
      if(!returning&&(stop(run)||final&&run.destinationReached||!final&&frame>=(seconds-EXPEDITION.anchorLockSeconds-1/fps)*fps))returning=true;
      let input={x:0,y:0};
      if(!returning){
        while(index<points.length-1&&Math.hypot(points[index].x-p.x,points[index].y-p.y)<60)index++;
        const target=points[index],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;input={x:dx/d,y:dy/d};
        if(start==='veil'&&p.y<-3570&&p.y>-3890&&p.x>390)beginBurst(run,(amount,id)=>resources.consumeTank('propellant',id,amount));
        if(start==='oxygen'&&Math.abs(p.x-850)<115)for(const y of [-9150,-9500,-9850,-10200])if(p.y>y&&p.y<y+42)beginBurst(run,(amount,id)=>resources.consumeTank('propellant',id,amount));
      }
      setCombustionHeld(run,burn&&!returning);
      for(const e of stepRun(run,input,1/fps,systems)){
        if(e.type==='element')resources.findElement(e.element);
        if(e.type==='region')resources.visit(e.region);
      }
      if(returning){lock+=1/fps;if(lock+1e-8>=EXPEDITION.anchorLockSeconds)break;}
    }
    const returned=lock+1e-8>=EXPEDITION.anchorLockSeconds&&!run.captured;
    const result=returned||run.captured?resources.settleExpedition(run.elementDust,run.best,run.captured,{destinationReached:run.destinationReached}):null;
    sorties.push({name,seconds:+run.time.toFixed(2),returned,captured:run.captured,destinationReached:run.destinationReached,result,launchStatus:launch.status,stock:{...resources.state.elements},remaining:structuredClone(resources.state.tanks)});
    if(!result)throw Error(`Unsettled timeout: ${name}`);return run;
  }
  for(let i=0;i<8&&resources.state.elements.H<242;i++)sortie({name:'H supply',routes:['entry','safe'],seconds:25});
  craft('hydrogen');select('propellant','hydrogen');
  for(let i=0;i<3&&!resources.canUseElement('C');i++)sortie({name:'discover C',routes:['entry','safe','approach','landing','carbon-entry'],stop:r=>r.collectedElements.C>=2});
  if(!resources.canUseElement('C'))throw Error('C not discovered');
  craft('methane');
  for(let i=0;i<3&&!resources.canUseElement('O');i++)sortie({name:'discover O',start:'carbon',routes:['carbon-entry','carbon-main','oxygen-entry'],stop:r=>r.collectedElements.O>=12});
  if(!resources.canUseElement('O'))throw Error('O not discovered');
  craft('oxygen');craft('water');if(propellant==='carbon-dioxide')craft('carbon-dioxide');
  // Replenish through real no-fuel sorties; no initial stock or scripted atom gifts.
  for(let i=0;i<8&&resources.state.elements.O<90;i++)sortie({name:'O supply',start:'oxygen',routes:['oxygen-entry','oxygen-eddy'],seconds:20});
  for(let i=0;i<8&&resources.state.elements.H<180;i++)sortie({name:'H refill',routes:['entry','safe'],seconds:25});
  for(let i=0;i<8&&resources.state.elements.C<18+(propellant==='carbon-dioxide'?72:0);i++)sortie({name:'C refill',start:'carbon',routes:['carbon-entry','carbon-main'],seconds:20});
  select('fuel','methane');select('oxidizer','oxygen');select('coolant','water');select('propellant',propellant);
  const preview=resources.launchFillPlan({includeWorkspace:false});if(preview.status==='IMPOSSIBLE')throw Error('Final LOADOUT is impossible');
  const planned=preview.status==='FULL'?preview.full:preview.partial,amount=use=>planned.entries.find(entry=>entry.use===use)?.target??0;
  const burnSeconds=Math.min(amount('fuel'),amount('oxidizer')/2)*2;
  if(burnSeconds<26)throw Error(`Insufficient collected fuel: ${burnSeconds}s`);
  sortie({name:'final',start:'oxygen',routes:['oxygen-main','oxygen-depth','horizon'],burn:true,final:true});
  const restored=createResources({storage});
  return {seed,propellant,fps,crafts,sorties,flightSeconds:+sorties.reduce((n,r)=>n+r.seconds,0).toFixed(2),completed:resources.state.progress.choCompleted,persisted:restored.state.progress.choCompleted};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await simulateChoCampaign(JSON.parse(process.argv[2]??'{}')),null,2));
