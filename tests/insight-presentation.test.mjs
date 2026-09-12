import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInsightPresentation,criticalInsightModels,insightAnalysisProgress} from '../src/veil/insight-presentation.js';
import {createResources} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
class Element{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.style={};this.dataset={};this.hidden=false;this.className='';this.id='';this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
}
class Document{constructor(){this.head=new Element('head',this);}createElement(tag){return new Element(tag,this);}getElementById(){return null;}}
const text=node=>[node.textContent,...node.children.flatMap(child=>[text(child)])].join(' ');
const resources=createResources({storage:memory()}),formula=id=>resources.record(id)?.formula??({ethane:'C₂H₆'}[id]??id),doc=new Document(),root=new Element('section',doc),sounds=[];
resources.state.hints.length=0;resources.state.recipes.length=0;
const presentation=createInsightPresentation({root,resources,formula,audio:{event:type=>sounds.push(type)},document:doc});

assert.equal(insightAnalysisProgress({progress:.4,elapsed:99,requiredDuration:5}),.4,'run.analysis.progress is the presentation source of truth');
assert.equal(insightAnalysisProgress({elapsed:2.5,requiredDuration:5}),.5,'elapsed/duration remains a canonical fallback');
assert.equal(insightAnalysisProgress({progress:2}),1);assert.equal(insightAnalysisProgress({progress:-1}),0);

const normal={time:1,analysis:{id:'ethane',elapsed:1,requiredDuration:5,progress:.2},carriedInsights:[]};
presentation.sync(normal);assert.equal(presentation.nodes.analysis.hidden,false);assert.equal(presentation.nodes.analysisTrack.getAttribute('aria-valuenow'),'20');assert.equal(presentation.nodes.analysisBar.style.transform,'scaleX(0.2)');assert.match(text(presentation.nodes.analysis),/ANALYZING/);assert.doesNotMatch(text(presentation.nodes.analysis),/C₂H₆|ethane/,'analysis must not reveal molecule identity before resolution');assert.equal(presentation.nodes.analysis.dataset.insightCategory,undefined,'analysis must not reveal category before resolution');
normal.analysis=null;normal.carriedInsights=['ethane'];assert.equal(presentation.ready({type:'insightReady',id:'ethane',critical:false},normal),true);presentation.sync(normal);assert.equal(presentation.nodes.analysis.hidden,true);assert.equal(presentation.nodes.ready.hidden,false);assert.equal(presentation.nodes.ready.dataset.insightCategory,'fuel');assert.match(presentation.nodes.readySymbol.className,/insight-bulb/);assert.equal(presentation.nodes.readyFormula.textContent,'C₂H₆');assert.match(presentation.nodes.ready.getAttribute('aria-label'),/FUEL/);assert.deepEqual(sounds,['insight']);assert.equal(presentation.nodes.critical.children.length,0,'normal carried insights are transient only');
normal.time=3.7;presentation.sync(normal);assert.equal(presentation.nodes.ready.hidden,true,'ready presentation expires without a UI timer');

const criticalRun={time:10,analysis:null,carriedInsights:['hydrogen','methane','oxygen','water']},models=criticalInsightModels(criticalRun,resources,formula),expectedCategories={hydrogen:'propellant',methane:'fuel',oxygen:'oxidizer',water:'coolant'};assert.equal(models.length,4);for(const model of models){assert.equal(model.category,expectedCategories[model.id]);assert.deepEqual(Object.fromEntries(model.atoms),resources.costFor(model.id));}
presentation.ready({type:'insightReady',id:'methane',critical:true},criticalRun);presentation.sync(criticalRun);assert.equal(presentation.nodes.analysis.hidden,true,'critical insights bypass analysis UI');assert.equal(presentation.nodes.critical.children.length,4);for(const chip of presentation.nodes.critical.children){const id=chip.dataset.insightId,cost=resources.costFor(id),chipText=text(chip);assert.equal(chip.dataset.insightCategory,expectedCategories[id]);assert.match(chip.children[0].className,/insight-bulb/);assert.match(chip.getAttribute('aria-label'),/用途 (PULSE|FUEL|OXIDIZER|COOLANT)/);assert.match(chipText,new RegExp(formula(id)));for(const [element,count] of Object.entries(cost))assert.match(chipText,new RegExp(`${element} ×${count}`));}
criticalRun.time=30;presentation.sync(criticalRun);assert.equal(presentation.nodes.critical.children.length,4,'critical indicators persist while carried');criticalRun.carriedInsights=[];presentation.sync(criticalRun);assert.equal(presentation.nodes.critical.children.length,0,'indicators disappear when the run loses or commits insights');

const generic=new Element('p',doc);generic.id='veil-message';generic.textContent='DANGER';generic.hidden=false;root.append(generic);presentation.ready({type:'insightReady',id:'ethane',critical:false},{time:40,analysis:null,carriedInsights:['ethane']});assert.equal(generic.textContent,'DANGER');assert.equal(generic.hidden,false,'dedicated insight layer must not overwrite generic FIELD notices');presentation.clear();assert.equal(presentation.nodes.ready.hidden,true);assert.equal(presentation.nodes.ready.dataset.insightCategory,undefined);assert.equal(presentation.nodes.critical.children.length,0);

const reducedRoot=new Element('section',doc),reduced=createInsightPresentation({root:reducedRoot,resources,formula,audio:{event:()=>{}},reduced:true,document:doc});assert.equal(reduced.nodes.group.dataset.reduced,'true');
const css=await readFile(new URL('../src/veil/insight-presentation.css',import.meta.url),'utf8'),categoryCss=await readFile(new URL('../src/insight-category.css',import.meta.url),'utf8'),ui=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');assert.match(css,/\.veil-insight-hud\{[^}]*pointer-events:none/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/animation:[^;}]*(infinite|linear infinite)/i);assert.match(categoryCss,/data-insight-category="fuel"/);assert.match(categoryCss,/\.insight-bulb\{[^}]*mask:/);assert.doesNotMatch(categoryCss,/opacity:\s*\.[0-4]/,'general bulb must not look disabled');assert.match(ui,/createInsightPresentation/);assert.match(ui,/insightPresentation\.sync\(run\)/);assert.match(ui,/insightPresentation\.ready\(event,run\)/);assert.doesNotMatch(ui,/insightAnalysisStart'\)\{notice\(/,'analysis must not use the generic notice layer');

console.log('FIELD insight presentation passed: anonymous analysis, role-colored mask bulb, accessible categories, canonical critical atoms, independent notice layer and reduced motion.');
