import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {furiganaSegmentsForRange} from '../src/encyclopedia-furigana.js';
import {moleculeSummaryGlossarySegments,partSummaryGlossarySegments} from '../src/encyclopedia-glossary.js';
import {hamajimaTermSegments} from '../src/hamajima-term-reference.js';

const encyclopedia=JSON.parse(readFileSync(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
const furigana=JSON.parse(readFileSync(new URL('../data/encyclopedia-furigana.json',import.meta.url),'utf8'));
const reconstruct=segments=>segments.map(item=>item.text).join('');

test('reviewed reading checkpoint changes only after an explicit contextual audit',()=>{
  const bytes=readFileSync(new URL('../data/encyclopedia-furigana.json',import.meta.url));
  const digest=createHash('sha256').update(bytes).digest('hex');
  const reviewed=readFileSync(new URL('./fixtures/encyclopedia-furigana-reviewed.sha256',import.meta.url),'utf8').trim();
  assert.equal(digest,reviewed,'Furigana changed: inspect EVERY changed reading in context before updating the reviewed digest');
});

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

test('context-sensitive chemical and everyday readings never use name/place defaults',()=>{
  const expectations=[
    {surface:'環',reading:'かん',matches:(text,offset)=>true,count:23},
    {surface:'三重',reading:'さんじゅう',matches:(text,offset)=>text.startsWith('三重結合',offset),count:4},
    {surface:'間',reading:'あいだ',matches:(text,offset)=>text.startsWith('間に',offset)||text.startsWith('間で',offset),count:2},
    {surface:'生',reading:'せい',matches:(text,offset)=>text.startsWith('生分解性',offset),count:1},
    {surface:'本',reading:'ぽん',matches:(text,offset)=>text.slice(Math.max(0,offset-1),offset+1)==='1本',count:1},
  ];
  for(const {surface,reading,matches,count} of expectations){
    let seen=0;
    for(const kind of ['molecules','parts']){
      for(const [id,{description}] of Object.entries(encyclopedia[kind])){
        for(const [offset,actual,pronunciation] of furigana[kind][id]){
          if(actual!==surface||!matches(description,offset))continue;
          assert.equal(pronunciation,reading,`${kind}:${id}: ${description}`);
          seen++;
        }
      }
    }
    assert.equal(seen,count,`${surface}: audit coverage changed`);
  }
  // The same character may have a different, correct reading in other contexts.
  assert.ok(furigana.molecules.cyclohexanol.some(([,surface,reading])=>surface==='環状'&&reading==='かんじょう'));
  assert.ok(furigana.molecules['carbon-monoxide'].some(([,surface,reading])=>surface==='生'&&reading==='しょう'));
  assert.ok(furigana.molecules['sulfur-dioxide'].some(([,surface,reading])=>surface==='雨'&&reading==='う'));
});

test('compound-specific readings override the isolated kanji only where needed',()=>{
  const cases=[
    {kanji:'鎖',reading:'さ',count:5,include:(description,index)=>description.slice(Math.max(0,index-2),index+1)==='炭素鎖'},
    {kanji:'塩',reading:'えん',count:4,include:(description,index)=>!description.startsWith('塩や',index)},
    {kanji:'濃',reading:'のう',count:1,include:(description,index)=>description.startsWith('濃硫酸',index)},
    {kanji:'湿',reading:'しつ',count:1,include:(description,index)=>description.slice(Math.max(0,index-1),index+2)==='保湿剤'},
    {kanji:'黄',reading:'おう',count:1,include:(description,index)=>description.startsWith('黄緑色',index)},
  ];
  for(const {kanji,reading,count,include} of cases){
    let observed=0;
    for(const kind of ['molecules','parts']){
      for(const [id,{description}] of Object.entries(encyclopedia[kind])){
        for(const [offset,surface,pronunciation] of furigana[kind][id]){
          if(surface!==kanji||!include(description,offset))continue;
          assert.equal(pronunciation,reading,`${kind}:${id}: ${description}`);
          observed++;
        }
      }
    }
    assert.equal(observed,count,`${kanji}: compound reading coverage`);
  }

  // Same glyphs still use their correct kun-yomi outside those compounds.
  assert.ok(furigana.molecules.water.some(([,surface,reading])=>surface==='塩'&&reading==='しお'));
  assert.ok(furigana.glossary['炭素鎖'].some(([,surface,reading])=>surface==='鎖'&&reading==='くさり'));
  assert.ok(furigana.molecules['sulfuric-acid'].some(([,surface,reading])=>surface==='鉛'&&reading==='なまり'));
  assert.ok(furigana.molecules.chlorine.some(([,surface,reading])=>surface==='緑色'&&reading==='りょくしょく'));
});

test('reviewed chemical phrases retain their full contextual readings across morpheme boundaries',()=>{
  // A tokenizer can produce kana-only, well-positioned ruby that is still semantically wrong.
  // Check complete phrases rather than the isolated kanji segmentation it happened to choose.
  const reviewed=[
    ['炭素鎖','たんそさ'],
    ['三重結合','さんじゅうけつごう'],
    ['間にはさんだ','あいだにはさんだ'],
    ['肝臓の間で','かんぞうのあいだで'],
    ['OH基','OHき'],
    ['環状','かんじょう'],
    ['生分解性','せいぶんかいせい'],
    ['保湿剤','ほしつざい'],
    ['黄緑色','おうりょくしょく'],
    ['塩の形','えんのかたち'],
    ['含フッ素','がんフッそ'],
  ];
  for(const [phrase,expected] of reviewed){
    let seen=0;
    for(const kind of ['molecules','parts']){
      for(const [id,{description}] of Object.entries(encyclopedia[kind])){
        let offset=-1;
        while((offset=description.indexOf(phrase,offset+1))!==-1){
          const pronunciation=furiganaSegmentsForRange(description,furigana[kind][id],offset,offset+phrase.length)
            .map(item=>item.kind==='ruby'?item.reading:item.text).join('');
          assert.equal(pronunciation,expected,`${kind}:${id}: ${phrase} in ${description}`);
          seen++;
        }
      }
    }
    assert.ok(seen>0,`${phrase}: expected a reviewed source occurrence`);
  }
  // 鎖 is correctly read differently in the standalone glossary explanation.
  const meaning='炭素の原子が鎖のようにつながった部分。';
  const start=meaning.indexOf('鎖のように');
  assert.equal(furiganaSegmentsForRange(meaning,furigana.glossary['炭素鎖'],start,start+'鎖のように'.length)
    .map(item=>item.kind==='ruby'?item.reading:item.text).join(''),'くさりのように');
});
