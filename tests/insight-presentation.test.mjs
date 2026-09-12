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
}
class Document{constructor(){this.head=new Element('head',this);}createElement(tag){return new Element(tag,this);}getElementById(){return null;}}
const text=node=>[node.textContent,...node.children.flatMap(child=>[text(child)])].join(' ');
const resources=createResources({storage:memory()}),formula=id=>resources.record(id)?.formula??({ethane:'C₂H₆'}[id]??id),doc=new Document(),root=new Element('section',doc),sounds=[];
const presentation=createInsightPresentation({root,resources,formula,audio:{event:type=>sounds.push(type)},document:doc});

assert.equal(insightAnalysisProgress({progress:.4,elapsed:99,requiredDuration:5}),.4,'run.analysis.progress is the presentation source of truth');
assert.equal(insightAnalysisProgress({elapsed:2.5,requiredDuration:5}),.5,'elapsed/duration remains a canonical fallback');
assert.equal(insightAnalysisProgress({progress:2}),1);assert.equal(insightAnalysisProgress({progress:-1}),0);

const normal={time:1,analysis:{id:'ethane',elapsed:1,requiredDuration:5,progress:.2},carriedInsights:[]};
presentation.sync(normal);assert.equal(presentation.nodes.analysis.hidden,false);assert.equal(presentation.nodes.analysisTrack.getAttribute('aria-valuenow'),'20');assert.equal(presentation.nodes.analysisBar.style.transform,'scaleX(0.2)');assert.match(text(presentation.nodes.analysis),/ANALYZING/);assert.doesNotMatch(text(presentation.nodes.analysis),/C₂H₆|ethane/,'analysis must not reveal molecule identity before resolution');
normal.analysis=null;normal.carriedInsights=['ethane'];assert.equal(presentation.ready({type:'insightReady',id:'ethane',critical:false},normal),true);presentation.sync(normal);assert.equal(presentation.nodes.analysis.hidden,true);assert.equal(presentation.nodes.ready.hidden,false);assert.match(text(presentation.nodes.ready),/💡/);assert.match(text(presentation.nodes.ready),/C₂H₆/);assert.deepEqual(sounds,['insight']);assert.equal(presentation.nodes.critical.children.length,0,'normal carried insights are transient only');
normal.time=3.5;presentation.sync(normal);assert.equal(presentation.nodes.ready.hidden,true,'ready presentation expires without a UI timer');

const criticalRun={time:10,analysis:null,carriedInsights:['methane']},methaneCost=resources.costFor('methane'),models=criticalInsightModels(criticalRun,resources,formula);assert.equal(models.length,1);assert.deepEqual(Object.fromEntries(models[0].atoms),methaneCost);
presentation.ready({type:'insightReady',id:'methane',critical:true},criticalRun);presentation.sync(criticalRun);assert.equal(presentation.nodes.analysis.hidden,true,'critical insights bypass analysis UI');assert.equal(presentation.nodes.critical.children.length,1);const chipText=text(presentation.nodes.critical.children[0]);assert.match(chipText,/💡/);assert.match(chipText,/CH₄/);for(const [element,count] of Object.entries(methaneCost))assert.match(chipText,new RegExp(`${element} ×${count}`));
criticalRun.time=30;presentation.sync(criticalRun);assert.equal(presentation.nodes.critical.children.length,1,'critical indicator persists while carried');criticalRun.carriedInsights=[];presentation.sync(criticalRun);assert.equal(presentation.nodes.critical.children.length,0,'indicator disappears when the run loses or commits the insight');

const generic=new Element('p',doc);generic.id='veil-message';generic.textContent='DANGER';generic.hidden=false;root.append(generic);presentation.ready({type:'insightReady',id:'ethane',critical:false},{time:40,analysis:null,carriedInsights:['ethane']});assert.equal(generic.textContent,'DANGER');assert.equal(generic.hidden,false,'dedicated insight layer must not overwrite generic FIELD notices');presentation.clear();assert.equal(presentation.nodes.ready.hidden,true);assert.equal(presentation.nodes.critical.children.length,0);

const reducedRoot=new Element('section',doc),reduced=createInsightPresentation({root:reducedRoot,resources,formula,audio:{event:()=>{}},reduced:true,document:doc});assert.equal(reduced.nodes.group.dataset.reduced,'true');
const css=await readFile(new URL('../src/veil/insight-presentation.css',import.meta.url),'utf8'),ui=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');assert.match(css,/\.veil-insight-hud\{[^}]*pointer-events:none/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/animation:[^;}]*(infinite|linear infinite)/i);assert.match(ui,/createInsightPresentation/);assert.match(ui,/insightPresentation\.sync\(run\)/);assert.match(ui,/insightPresentation\.ready\(event,run\)/);assert.doesNotMatch(ui,/insightAnalysisStart'\)\{notice\(/,'analysis must not use the generic notice layer');

console.log('FIELD insight presentation passed: state-driven anonymous analysis, dedicated bulb resolution, canonical critical atoms, independent notice layer and reduced motion.');
