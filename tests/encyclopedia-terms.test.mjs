import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCYCLOPEDIA_TERM_CATALOG,encyclopediaTerm,
  MOLECULE_GLOSSARY_DEFINITIONS,PART_GLOSSARY_DEFINITIONS,
  HAMAJIMA_TERM_REFERENCES,moleculeSummaryGlossarySegments,
  partSummaryGlossarySegments,hamajimaTermSegments,
} from '../src/encyclopedia-terms.js';
import * as glossaryCompatibility from '../src/encyclopedia-glossary.js';
import * as referenceCompatibility from '../src/hamajima-term-reference.js';

test('224 terms have one source of truth with all legacy content preserved',()=>{
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.length,224);
  assert.equal(new Set(ENCYCLOPEDIA_TERM_CATALOG.map(entry=>entry.term)).size,224);
  assert.equal(MOLECULE_GLOSSARY_DEFINITIONS.length,76);
  assert.equal(PART_GLOSSARY_DEFINITIONS.length,20);
  assert.equal(Object.keys(HAMAJIMA_TERM_REFERENCES).length,62);
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.candidateWave!==null).length,75);
  assert.equal(ENCYCLOPEDIA_TERM_CATALOG.filter(entry=>entry.meaning&&entry.referencePageId).length,9);
  for(const entry of ENCYCLOPEDIA_TERM_CATALOG){
    assert.equal(encyclopediaTerm(entry.term),entry);
    assert.equal(entry.meaning!==null,entry.summaryScope!==null,entry.term);
  }
  assert.equal(encyclopediaTerm('触媒').meaning,null,'An unreviewed candidate must not masquerade as a completed explanation.');
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
