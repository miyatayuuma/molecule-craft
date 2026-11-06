import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ENCYCLOPEDIA_TERM_CATALOG,encyclopediaTerm,
  MOLECULE_GLOSSARY_DEFINITIONS,PART_GLOSSARY_DEFINITIONS,
  HAMAJIMA_TERM_REFERENCES,moleculeSummaryGlossarySegments,
  partSummaryGlossarySegments,hamajimaTermSegments,
} from '../src/encyclopedia-terms.js';
import * as glossaryCompatibility from '../src/encyclopedia-glossary.js';
import * as referenceCompatibility from '../src/hamajima-term-reference.js';

test('224 terms have one source of truth and complete editorial meanings without changing popup scope',()=>{
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.length,224);
  assert.equal(new Set(ENCYCLOPEDIA_TERM_CATALOG.map(entry=>entry.term)).size,224);
  assert.equal(MOLECULE_GLOSSARY_DEFINITIONS.length,76);
  assert.equal(PART_GLOSSARY_DEFINITIONS.length,20);
  assert.equal(Object.keys(HAMAJIMA_TERM_REFERENCES).length,62);
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.candidateWave!==null).length,75);
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.summaryScope!==null&&entry.referencePageId).length,9);
  for(const entry of ENCYCLOPEDIA_TERM_CATALOG){
    assert.equal(encyclopediaTerm(entry.term),entry);
    assert.ok(typeof entry.meaning==='string'&&entry.meaning.trim().length>0,`${entry.term} requires a written meaning`);
    assert.ok(entry.meaning.length<=140,`${entry.term} meaning is too long for the first-layer explanation`);
  }
  assert.ok(encyclopediaTerm('触媒').meaning.includes('反応'));
  assert.equal(encyclopediaTerm('触媒').summaryScope,null,'Editorial copy must not silently activate an existing popup.');
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.summaryScope!==null).length,96);
});

test('technical distinctions and alternate spellings are consistent in the written ledger',()=>{
  const meaning=term=>encyclopediaTerm(term)?.meaning;
  assert.match(meaning('酸化'),/電子を失う/);
  assert.match(meaning('還元'),/電子を受け取る/);
  assert.match(meaning('酸化剤'),/電子を受け取/);
  assert.match(meaning('還元剤'),/電子を与え/);
  assert.match(meaning('シクロアルカン'),/単結合/);
  assert.match(meaning('アルコール'),/単結合/);
  assert.equal(meaning('タンパク質'),meaning('たんぱく質'));
  assert.equal(meaning('反復単位'),meaning('繰り返し単位').replace('反復単位ともいう。','').trim());
  assert.match(meaning('ポリマー'),/高分子/);
  assert.match(meaning('高分子'),/構成単位/);
});

test('review ledger separates approved current terms from seven unused reference-only terms',()=>{
  const report=JSON.parse(readFileSync(new URL('../docs/encyclopedia-term-ledger.json',import.meta.url),'utf8'));
  assert.equal(report.schemaVersion,2);
  assert.equal(report.definitionReadyCount,224);
  assert.equal(report.activeCount,217);
  assert.deepEqual(report.entries.filter(row=>row.disposition.startsWith('保留')).map(row=>row.term).sort(),[
    'シス-トランス異性体','不対電子','共有結合','共有電子対','混成軌道','配位結合','非共有電子対',
  ].sort());
  for(const row of report.entries){
    assert.equal(row.definitionReady,true,row.term);
    assert.equal(row.meaning,encyclopediaTerm(row.term)?.meaning,row.term);
  }
});

test('legacy entrypoints delegate to the unified term authority',()=>{
  assert.equal(glossaryCompatibility.MOLECULE_GLOSSARY_DEFINITIONS,MOLECULE_GLOSSARY_DEFINITIONS);
  assert.equal(glossaryCompatibility.PART_GLOSSARY_DEFINITIONS,PART_GLOSSARY_DEFINITIONS);
  assert.equal(glossaryCompatibility.moleculeSummaryGlossarySegments,moleculeSummaryGlossarySegments);
  assert.equal(glossaryCompatibility.partSummaryGlossarySegments,partSummaryGlossarySegments);
  assert.equal(referenceCompatibility.HAMAJIMA_TERM_REFERENCES,HAMAJIMA_TERM_REFERENCES);
  assert.equal(referenceCompatibility.hamajimaTermSegments,hamajimaTermSegments);
});

test('summary limits, scoped meanings, and external-only terms preserve existing behavior',()=>{
  const summary=moleculeSummaryGlossarySegments('原子は物質をつくる。水素イオンは電子を失った粒。');
  assert.deepEqual(summary.filter(segment=>segment.kind==='term').map(segment=>segment.text),['原子']);
  const parts=partSummaryGlossarySegments('原子は物質をつくる。水素イオンは電子を失った粒。');
  assert.deepEqual(parts.filter(segment=>segment.kind==='term').map(segment=>segment.text),['原子','水素イオン','電子']);
  assert.equal(moleculeSummaryGlossarySegments('触媒と二重結合。').some(segment=>segment.kind==='term'),false);
  assert.deepEqual(hamajimaTermSegments('二重結合と触媒。').filter(segment=>segment.kind==='term').map(segment=>segment.text),['二重結合']);
  assert.deepEqual(hamajimaTermSegments('二酸化炭素'),[{kind:'text',text:'二酸化炭素'}]);
});
