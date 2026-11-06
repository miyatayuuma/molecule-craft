import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {furiganaSegmentsForRange,coalesceSegmentsAtRubyBoundaries,completeFuriganaSegments,createCompleteFuriganaIndex} from '../src/encyclopedia-furigana.js';
import {ENCYCLOPEDIA_TERM_CATALOG,encyclopediaTermSegments} from '../src/encyclopedia-terms.js';

const encyclopedia=JSON.parse(readFileSync(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
const furigana=JSON.parse(readFileSync(new URL('../data/encyclopedia-furigana.json',import.meta.url),'utf8'));
const reconstruct=segments=>segments.map(item=>item.text).join('');

test('in-app glossary triggers never cut through a complete ruby span',()=>{
  const corpus=JSON.parse(readFileSync(new URL('../data/encyclopedia-extra-furigana.json',import.meta.url)));
  let crossingCount=0;
  for(const [text,annotations] of Object.entries(corpus.texts)){
    const raw=encyclopediaTermSegments(text,{limit:4});
    const chunks=coalesceSegmentsAtRubyBoundaries(raw,annotations);
    assert.equal(reconstruct(chunks),text);
    let offset=0;
    const covered=new Set();
    for(const chunk of chunks){
      const pieces=furiganaSegmentsForRange(text,annotations,offset,offset+chunk.text.length);
      assert.equal(reconstruct(pieces),chunk.text);
      let cursor=offset;
      for(const piece of pieces){
        if(piece.kind==='ruby')for(let at=cursor;at<cursor+piece.text.length;at++)covered.add(at);
        cursor+=piece.text.length;
      }
      offset+=chunk.text.length;
    }
    for(const [at,surface] of annotations){
      for(let i=at;i<at+surface.length;i++)assert.ok(covered.has(i),`glossary trigger hides ruby at ${i}: ${text}`);
    }
    if(chunks.length<raw.length)crossingCount++;
  }
  assert.ok(crossingCount>0,'test corpus must contain intersecting glossary triggers');
  const sentence='プロピレンの付加重合体。主鎖にメチル置換基を持つ。';
  const annotations=corpus.texts[sentence];
  assert.ok(annotations?.some(([,surface,reading])=>surface==='付加重合体'&&reading==='ふかじゅうごうたい'));
  const original=encyclopediaTermSegments(sentence);
  assert.ok(original.some(x=>x.kind==='term'&&x.text==='付加重合'));
  const fixed=coalesceSegmentsAtRubyBoundaries(original,annotations);
  assert.ok(fixed.some(x=>x.kind==='text'&&x.text.includes('付加重合体')));
  assert.ok(!fixed.some(x=>x.kind==='term'&&x.text==='付加重合'));
});

test('all encyclopedia science texts have complete Kanji-only ruby, not a 26-term whitelist',()=>{
 const corpus=JSON.parse(readFileSync(new URL('../data/encyclopedia-extra-furigana.json',import.meta.url)));
 assert.equal(corpus.schemaVersion,1);
 assert.ok(Object.keys(corpus.texts).length>=1000);
 const current=JSON.parse(execFileSync(process.execPath,[new URL('../scripts/collect-encyclopedia-ruby-texts.mjs',import.meta.url).pathname],{encoding:'utf8'}));
 assert.deepEqual(Object.keys(corpus.texts).sort(),current.sort(),'source text changed: regenerate, audit and review missing ruby');
 const index=createCompleteFuriganaIndex(corpus);
 for(const kind of ['molecules','parts'])for(const [id,entry] of Object.entries(encyclopedia[kind])){
   assert.deepEqual(corpus.texts[entry.description],furigana[kind][id],`curated ${kind}:${id} ruby must not regress`);
 }
 for(const [text,annotations] of Object.entries(corpus.texts)){
   const covered=new Set();let end=0;
   for(const [offset,surface,reading] of annotations){
     assert.ok(Number.isInteger(offset)&&offset>=end,`overlap: ${text}`);
     assert.equal(text.slice(offset,offset+surface.length),surface,`stale source: ${text}`);
     assert.match(surface,/^[一-龯々]+$/u,`not kanji-only: ${text}`);
     assert.match(reading,/^[ぁ-ゖー]+$/u,`invalid reading: ${text}`);
     for(let i=offset;i<offset+surface.length;i++)covered.add(i);
     end=offset+surface.length;
   }
   for(let i=0;i<text.length;i++)if(/[一-龯々]/u.test(text[i]))assert.ok(covered.has(i),`missing ruby at ${i}: ${text}`);
   assert.equal(reconstruct(completeFuriganaSegments(text,index)),text);
 }
 const readingOf=(source,term)=>{
   const [text,annotations]=Object.entries(corpus.texts).find(([text])=>text.includes(source));
   const start=text.indexOf(term);
   const spans=annotations.filter(([offset])=>offset>=start&&offset<start+term.length);
   return spans.map(([,surface,reading])=>surface).join('')+':'+spans.map(([,surface,reading])=>reading).join('');
 };
 assert.equal(readingOf('三方両錐形','三方両錐形'),'三方両錐形:さんぽうりょうすいけい');
 assert.equal(readingOf('開環反応','開環'),'開環:かいかん');
 assert.equal(readingOf('縮合して','縮合'),'縮合:しゅくごう');
 assert.equal(readingOf('求核剤','求核剤'),'求核剤:きゅうかくざい');
 assert.equal(readingOf('保湿剤','保湿剤'),'保湿剤:ほしつざい');
 assert.equal(readingOf('炭素鎖','炭素鎖'),'炭素鎖:たんそさ');
 const chemistryReadings={
   '側鎖':'そくさ','直鎖':'ちょくさ','鎖長':'さちょう','共重合体':'きょうじゅうごうたい',
   '付加重合体':'ふかじゅうごうたい','四面体':'しめんたい','四面体形':'しめんたいけい',
   '網目':'あみめ','水和':'すいわ','不斉':'ふせい','酸無水物':'さんむすいぶつ',
   '炭素数':'たんそすう','原子数':'げんしすう','頭尾結合':'とうびけつごう',
   '四塩化炭素':'しえんかたんそ','分子間力':'ぶんしかんりょく',
   // Contextual readings that a general Japanese tokenizer got wrong in the
   // first all-Kanji release: coverage alone did not catch these mistakes.
   '懸濁':'けんだく','多価':'たか','正四面体':'せいしめんたい',
   '正四面体形':'せいしめんたいけい','改質':'かいしつ',
   '実鎖長':'じつさちょう','実工程':'じつこうてい',
   '水素化物':'すいそかぶつ',
   '炭化水素':'たんかすいそ',
   '双極子':'そうきょくし','六角形':'ろっかっけい',
   '三角平面形':'さんかくへいめんけい','第一級':'だいいっきゅう',
 };
 for(const [word,expected] of Object.entries(chemistryReadings)){
   let seen=0;
   for(const [text,annotations] of Object.entries(corpus.texts)){
     for(let start=text.indexOf(word);start>=0;start=text.indexOf(word,start+1)){
       const pieces=annotations.filter(([i,surface])=>i>=start&&i+surface.length<=start+word.length);
       if(pieces.map(([,surface])=>surface).join('')!==word)continue;
       assert.equal(pieces.map(([,surface,reading])=>reading).join(''),expected,`${word} in ${text}`);
       seen++;
     }
   }
   assert.ok(seen>0,`${word}: no reviewed example`);
 }
 // These single-character readings looked plausible to a generic tokenizer,
 // but refer to chemical charge, numerical valence, and molecular shape here.
 for(const [text,annotations] of Object.entries(corpus.texts)){
   for(const [offset,surface,reading] of annotations){
     assert.notEqual(reading,'ばけもの',`chemical 化物 misread in ${text}`);
     assert.notEqual(reading,'まけ',`negative electric charge misread in ${text}`);
     assert.notEqual(reading,'くざい',`mixed-kana alignment lost 薬 in ${text}`);
     if(surface==='負')assert.equal(reading,'ふ',text);
     if(surface==='型')assert.equal(reading,'がた',text);
     if(surface==='薬剤')assert.equal(reading,'やくざい',text);
   }
 }
 const mixedPhrase=Object.entries(corpus.texts).find(([text])=>text.includes('塩や薬剤'));
 assert.ok(mixedPhrase);
 const [mixedText,mixedAnnotations]=mixedPhrase;
 const salt=mixedText.indexOf('塩や薬剤');
 assert.deepEqual(mixedAnnotations.filter(([offset])=>offset>=salt&&offset<salt+4).map(([,surface,reading])=>[surface,reading]),[
   ['塩','えん'],['薬剤','やくざい']
 ]);
 const dynamic='LABの条件：酸性、加熱';
 const parts=completeFuriganaSegments(dynamic,index);
 assert.equal(reconstruct(parts),dynamic);
 assert.equal(parts.filter(p=>p.kind==='text').flatMap(p=>[...p.text]).some(ch=>/[一-龯々]/u.test(ch)),false,'dynamic labels have missing readings');
});

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

test('in-app glossary triggers preserve the full description and ruby readings',()=>{
  for(const [id,entry] of Object.entries(encyclopedia.molecules)){
    let cursor=0,visible='',readingCount=0;
    for(const glossarySegment of coalesceSegmentsAtRubyBoundaries(encyclopediaTermSegments(entry.description,{limit:3}),furigana.molecules[id])){
      const segments=furiganaSegmentsForRange(entry.description,furigana.molecules[id],cursor,cursor+glossarySegment.text.length);
      visible+=reconstruct(segments);
      readingCount+=segments.filter(item=>item.kind==='ruby').length;
      cursor+=glossarySegment.text.length;
    }
    assert.equal(visible,entry.description,id);
    assert.equal(readingCount,furigana.molecules[id].length,`${id}: glossary must not hide a reading`);
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

test('chemical names are not split into misleading oxidation explanations',()=>{
  for(const compound of ['一酸化炭素','二酸化炭素']){
    const segments=encyclopediaTermSegments(compound);
    assert.equal(reconstruct(segments),compound);
    assert.ok(!segments.some(segment=>segment.kind==='term'&&segment.text==='酸化'));
  }
});

test('all 17 part descriptions have intact readings and no glossary gaps',()=>{
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
    const glossary=coalesceSegmentsAtRubyBoundaries(encyclopediaTermSegments(description,{limit:3}),annotations);
    assert.ok(glossary.filter(segment=>segment.kind==='term').length<=3,id);
    assert.ok(glossary.some(segment=>segment.kind==='term'),`${id}: at least one difficult term should have a meaning`);
    for(const item of glossary){
      const rendered=furiganaSegmentsForRange(description,annotations,offset,offset+item.text.length);
      visible+=reconstruct(rendered);
      readingCount+=rendered.filter(segment=>segment.kind==='ruby').length;
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

test('all 224 glossary meanings have complete Kanji-only furigana before UI rollout',()=>{
  const definitions=ENCYCLOPEDIA_TERM_CATALOG.map(entry=>[null,entry.term,entry.meaning]);
  assert.equal(definitions.length,224);
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

test('new glossary chemical compounds have reviewed on-yomi without changing standalone readings',()=>{
  const phrases=[
    ['側鎖','主鎖','しゅさ'],
    ['主鎖','側鎖','そくさ'],
    ['立体規則性','側鎖','そくさ'],
    ['アルカン','鎖状','さじょう'],
    ['酸無水物','酸無水物','さんむすいぶつ'],
    ['電子対','一組','ひとくみ'],
    ['主鎖','鎖。','くさり。'],
  ];
  for(const [term,phrase,reading] of phrases){
    const meaning=ENCYCLOPEDIA_TERM_CATALOG.find(entry=>entry.term===term)?.meaning;
    assert.ok(meaning?.includes(phrase),`${term}: source context missing ${phrase}`);
    const start=meaning.indexOf(phrase);
    const result=furiganaSegmentsForRange(meaning,furigana.glossary[term],start,start+phrase.length)
      .map(part=>part.kind==='ruby'?part.reading:part.text).join('');
    assert.equal(result,reading,`${term}: ${phrase}`);
  }
});

test('unfamiliar everyday vocabulary such as 不凍液 now opens an explanation',()=>{
  const found=encyclopediaTermSegments('不凍液は液化した材料と違う');
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
