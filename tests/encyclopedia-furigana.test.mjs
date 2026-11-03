import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {furiganaSegmentsForRange} from '../src/encyclopedia-furigana.js';
import {moleculeSummaryGlossarySegments,partSummaryGlossarySegments} from '../src/encyclopedia-glossary.js';
import {hamajimaTermSegments} from '../src/hamajima-term-reference.js';

const encyclopedia=JSON.parse(readFileSync(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
const furigana=JSON.parse(readFileSync(new URL('../data/encyclopedia-furigana.json',import.meta.url),'utf8'));
const reconstruct=segments=>segments.map(item=>item.text).join('');

test('all 142 molecule summaries have exact, non-overlapping kana readings',()=>{
  assert.equal(furigana.schemaVersion,2);
  assert.deepEqual(Object.keys(furigana.molecules).sort(),Object.keys(encyclopedia.molecules).sort());
  for(const [id,entry] of Object.entries(encyclopedia.molecules)){
    const {description}=entry,annotations=furigana.molecules[id];
    assert.ok(annotations.length>0,id);
    let end=0;
    for(const [offset,surface,reading] of annotations){
      assert.ok(Number.isInteger(offset)&&offset>=end,`${id}: reading overlaps`);
      assert.equal(description.slice(offset,offset+surface.length),surface,`${id}: source text changed`);
      assert.match(surface,/^[一-龯々]+$/u,`${id}: ruby must cover Kanji only`);
      assert.match(reading,/^[ぁ-ゖー]+$/u,`${id}: expected a hiragana reading`);
      end=offset+surface.length;
    }
    assert.equal(reconstruct(furiganaSegmentsForRange(description,annotations)),description,id);
  }
});

test('glossary popups and chemical dictionary links preserve the full description',()=>{
  for(const [id,entry] of Object.entries(encyclopedia.molecules)){
    let cursor=0,visible='',readingCount=0;
    for(const glossarySegment of moleculeSummaryGlossarySegments(entry.description)){
      if(glossarySegment.kind==='term'){
        const segments=furiganaSegmentsForRange(entry.description,furigana.molecules[id],cursor,cursor+glossarySegment.text.length);
        visible+=reconstruct(segments);
        readingCount+=segments.filter(item=>item.kind==='ruby').length;
      }else{
        let childOffset=cursor;
        for(const segment of hamajimaTermSegments(glossarySegment.text)){
          const segments=furiganaSegmentsForRange(entry.description,furigana.molecules[id],childOffset,childOffset+segment.text.length);
          visible+=reconstruct(segments);
          readingCount+=segments.filter(item=>item.kind==='ruby').length;
          childOffset+=segment.text.length;
        }
      }
      cursor+=glossarySegment.text.length;
    }
    assert.equal(visible,entry.description,id);
    assert.equal(readingCount,furigana.molecules[id].length,`${id}: split link/glossary must not hide a reading`);
  }
});

test('stale or overlapping readings fall back to the original source text',()=>{
  const text='水は軽い。';
  const annotations=[[0,'水','みず'],[2,'軽','かる'],[2,'軽','まちがい'],[3,'ない','ない']];
  assert.deepEqual(furiganaSegmentsForRange(text,annotations),[
    {kind:'ruby',text:'水',reading:'みず'},
    {kind:'text',text:'は'},
    {kind:'ruby',text:'軽',reading:'かる'},
    {kind:'text',text:'い。'},
  ]);
  assert.deepEqual(furiganaSegmentsForRange(text,annotations,1,4).map(item=>item.text),['は','軽','い']);
});

test('exceptional compound readings are corrected in the source data',()=>{
  const annotations=Object.values(furigana.molecules).flat();
  assert.ok(annotations.some(([,surface,reading])=>surface==='共'&&reading==='きょう'));
  assert.ok(annotations.some(([,surface,reading])=>surface==='含'&&reading==='がん'));
});

test('chemical names are not split into misleading oxidation links',()=>{
  for(const compound of ['一酸化炭素','二酸化炭素']){
    assert.deepEqual(hamajimaTermSegments(compound),[{kind:'text',text:compound}]);
  }
});

test('all 17 part descriptions have intact readings and no glossary/link gaps',()=>{
  assert.deepEqual(Object.keys(furigana.parts).sort(),Object.keys(encyclopedia.parts).sort());
  for(const [id,{description}] of Object.entries(encyclopedia.parts)){
    const annotations=furigana.parts[id];
    assert.ok(annotations.length>0,id);
    let previousEnd=0;
    for(const [offset,surface,reading] of annotations){
      assert.ok(Number.isInteger(offset)&&offset>=previousEnd,id);
      assert.equal(description.slice(offset,offset+surface.length),surface,id);
      assert.match(surface,/^[一-龯々]+$/u,`${id}: ruby must cover Kanji only`);
      assert.match(reading,/^[ぁ-ゖー]+$/u,id);
      previousEnd=offset+surface.length;
    }
    let offset=0,readingCount=0,visible='';
    const glossary=partSummaryGlossarySegments(description);
    assert.ok(glossary.filter(segment=>segment.kind==='term').length<=3,id);
    assert.ok(glossary.some(segment=>segment.kind==='term'),`${id}: at least one difficult term should have a meaning`);
    for(const item of glossary){
      const pieces=item.kind==='term'?[item]:hamajimaTermSegments(item.text);
      let innerOffset=offset;
      for(const piece of pieces){
        const rendered=furiganaSegmentsForRange(description,annotations,innerOffset,innerOffset+piece.text.length);
        visible+=reconstruct(rendered);
        readingCount+=rendered.filter(segment=>segment.kind==='ruby').length;
        innerOffset+=piece.text.length;
      }
      offset+=item.text.length;
    }
    assert.equal(visible,description,id);
    assert.equal(readingCount,annotations.length,`${id}: all kanji readings remain visible`);
  }
  const aldehyde=furigana.parts.aldehyde;
  assert.ok(aldehyde.some(([,surface,reading])=>surface==='基'&&reading==='き'));
});

test('all kanji in both catalog summaries have readings and every functional-group 基 reads き',()=>{
  for(const kind of ['molecules','parts']){
    for(const [id,{description}] of Object.entries(encyclopedia[kind])){
      const covered=new Set();
      for(const [offset,surface,reading] of furigana[kind][id]){
        if(surface==='基')assert.equal(reading,'き',id);
        for(let i=0;i<surface.length;i++)covered.add(offset+i);
      }
      for(let i=0;i<description.length;i++){
        if(/[一-龯々]/u.test(description[i]))assert.ok(covered.has(i),`${kind}:${id}: Kanji without reading at ${i}`);
      }
    }
  }
});

test('glossary popup descriptions have complete Kanji-only furigana',()=>{
  const glossarySource=readFileSync(new URL('../src/encyclopedia-glossary.js',import.meta.url),'utf8');
  const definitions=[...glossarySource.matchAll(/^\s*\['([^']+)','([^']+)',[12]\],?$/gm)];
  assert.ok(definitions.length>=90);
  assert.deepEqual(Object.keys(furigana.glossary).sort(),definitions.map(item=>item[1]).sort());
  for(const [,word,meaning] of definitions){
    const annotations=furigana.glossary[word],covered=new Set();
    let end=0;
    for(const [offset,surface,reading] of annotations){
      assert.ok(offset>=end,`${word}: overlapping ruby`);
      assert.equal(meaning.slice(offset,offset+surface.length),surface,word);
      assert.match(surface,/^[一-龯々]+$/u,`${word}: kana inside ruby`);
      assert.match(reading,/^[ぁ-ゖー]+$/u,word);
      for(let i=0;i<surface.length;i++)covered.add(offset+i);
      end=offset+surface.length;
    }
    for(let i=0;i<meaning.length;i++){
      if(/[一-龯々]/u.test(meaning[i]))assert.ok(covered.has(i),`${word}: no reading at ${i}`);
    }
    assert.equal(reconstruct(furiganaSegmentsForRange(meaning,annotations)),meaning,word);
  }
});

test('unfamiliar everyday vocabulary such as 不凍液 now opens an explanation',()=>{
  const found=moleculeSummaryGlossarySegments('不凍液は液化した材料と違う');
  assert.ok(found.some(item=>item.kind==='term'&&item.text==='不凍液'));
  assert.ok(found.some(item=>item.kind==='term'&&item.text==='液化'));
});
