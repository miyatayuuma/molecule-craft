import {ENCYCLOPEDIA_TERM_CATALOG} from './encyclopedia-term-catalog.js';

const CHEMTERM_BASE_URL='https://www.hamajima.co.jp/rika/chemterm/';
const TERMS=new Map();
for(const entry of ENCYCLOPEDIA_TERM_CATALOG){
  if(!entry.term||typeof entry.term!=='string'||TERMS.has(entry.term))throw Error(`Invalid/duplicate encyclopedia term: ${entry.term}`);
  if(entry.meaning!==null&&(typeof entry.meaning!=='string'||!entry.meaning.trim()))throw Error(`Invalid term meaning: ${entry.term}`);
  if((entry.summaryScope!==null&&entry.meaning===null)||
    (entry.summaryScope!==null&&!['both','parts'].includes(entry.summaryScope))||
    (entry.summaryScope!==null&&![1,2].includes(entry.summaryPriority))||
    (entry.summaryScope===null&&entry.summaryPriority!==null))throw Error(`Invalid summary glossary fields: ${entry.term}`);
  if(entry.referencePageId!==null&&!/^\d{8}$/.test(entry.referencePageId))throw Error(`Invalid reference page: ${entry.term}`);
  // Inventory wave is historical metadata, not a marker that editorial meaning is missing.
  // Newly written meanings are deliberately not activated in summary popups until UI phase 4.
  if(entry.candidateWave!==null&&(![1,2].includes(entry.candidateWave)||entry.referencePageId!==null))throw Error(`Invalid inventory candidate: ${entry.term}`);
  TERMS.set(entry.term,entry);
}

export {ENCYCLOPEDIA_TERM_CATALOG};
export const encyclopediaTerm=term=>TERMS.get(term)??null;

export const MOLECULE_GLOSSARY_DEFINITIONS=Object.freeze(ENCYCLOPEDIA_TERM_CATALOG
  .filter(entry=>entry.summaryScope==='both')
  .map(entry=>Object.freeze([entry.term,entry.meaning,entry.summaryPriority])));
export const PART_GLOSSARY_DEFINITIONS=Object.freeze(ENCYCLOPEDIA_TERM_CATALOG
  .filter(entry=>entry.summaryScope==='parts')
  .map(entry=>Object.freeze([entry.term,entry.meaning,entry.summaryPriority])));

export const HAMAJIMA_TERM_REFERENCES=Object.freeze(Object.fromEntries(ENCYCLOPEDIA_TERM_CATALOG
  .filter(entry=>entry.referencePageId)
  .map(entry=>[entry.term,Object.freeze({
    term:entry.term,
    pageId:entry.referencePageId,
    url:`${CHEMTERM_BASE_URL}${entry.referencePageId}.html`,
  })])));

const longerFirst=(left,right)=>[...right.term].length-[...left.term].length;
const MOLECULE_MATCH_ORDER=ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.summaryScope==='both').sort(longerFirst);
const PART_MATCH_ORDER=ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.summaryScope!==null).sort(longerFirst);
const REFERENCE_MATCH_ORDER=ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.referencePageId)
  .sort((left,right)=>longerFirst(left,right)||(left.term<right.term?-1:left.term>right.term?1:0));

function findMatches(text,terms,mode){
  const found=[];
  for(let index=0;index<text.length;){
    const entry=terms.find(item=>text.startsWith(item.term,index));
    if(!entry){index++;continue;}
    const {term}=entry;
    if(term==='酸化'){
      const next=text.slice(index+term.length);
      if(mode==='summary'&&(/[一二]$/.test(text.slice(0,index))&&next.startsWith('炭素')||/^(物|剤|数|力)/.test(next))){index+=term.length;continue;}
      if(mode==='reference'&&/[一二]/.test(text.slice(index-1,index))&&next.startsWith('炭素')){index+=term.length;continue;}
    }
    found.push({index,entry});index+=term.length;
  }
  return found;
}

function renderSegments(text,matches,termSegment){
  const result=[];let cursor=0;
  for(const {index,entry} of matches){
    if(index>cursor)result.push({kind:'text',text:text.slice(cursor,index)});
    result.push(termSegment(entry));cursor=index+entry.term.length;
  }
  if(cursor<text.length)result.push({kind:'text',text:text.slice(cursor)});
  return result;
}

function summarySegments(value,scope,{limit=3}={}){
  const text=String(value??'');
  const terms=scope==='parts'?PART_MATCH_ORDER:MOLECULE_MATCH_ORDER;
  const seen=new Set();
  const found=findMatches(text,terms,'summary').filter(({entry})=>{
    if(seen.has(entry.term))return false;
    seen.add(entry.term);return true;
  });
  const selected=found.sort((left,right)=>right.entry.summaryPriority-left.entry.summaryPriority||left.index-right.index)
    .slice(0,Math.max(0,limit)).sort((left,right)=>left.index-right.index);
  return renderSegments(text,selected,entry=>({kind:'term',text:entry.term,meaning:entry.meaning}));
}

export const moleculeSummaryGlossarySegments=(value,options)=>summarySegments(value,'molecules',options);
export const partSummaryGlossarySegments=(value,options)=>summarySegments(value,'parts',options);

export function hamajimaTermReference(displayTerm){
  return Object.hasOwn(HAMAJIMA_TERM_REFERENCES,displayTerm)?HAMAJIMA_TERM_REFERENCES[displayTerm]:null;
}

export function hamajimaTermSegments(value){
  const text=typeof value==='string'?value:String(value??'');
  const found=findMatches(text,REFERENCE_MATCH_ORDER,'reference');
  return renderSegments(text,found,entry=>({kind:'term',text:entry.term,reference:HAMAJIMA_TERM_REFERENCES[entry.term]}));
}
