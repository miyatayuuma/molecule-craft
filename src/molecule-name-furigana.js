// Reviewed readings for all kanji-containing molecule display names.
// Each name currently has one contiguous kanji run; kana around it stays plain.
const KANJI_READINGS=Object.freeze({
  '水素':'すいそ',
  '酸素':'さんそ',
  '窒素':'ちっそ',
  '水':'みず',
  '二酸化炭素':'にさんかたんそ',
  '一酸化炭素':'いっさんかたんそ',
  '硫化水素':'りゅうかすいそ',
  '塩化水素':'えんかすいそ',
  'フッ化水素':'かすいそ',
  '塩素':'えんそ',
  '二酸化硫黄':'にさんかいおう',
  '三酸化硫黄':'さんさんかいおう',
  '三塩化リン':'さんえんか',
  '五塩化リン':'ごえんか',
  '二硫化炭素':'にりゅうかたんそ',
  '硫化カルボニル':'りゅうか',
  'リン酸':'さん',
  '硫酸':'りゅうさん',
  '過酸化水素':'かさんかすいそ',
  '次亜塩素酸':'じあえんそさん',
  '炭酸':'たんさん',
  'フッ化ビニリデン':'か',
  '四塩化炭素':'しえんかたんそ',
  '塩化ビニル':'えんか',
  '硫化ジメチル':'りゅうか',
  'ギ酸':'さん',
  '酢酸':'さくさん',
  'プロピオン酸':'さん',
  '酪酸':'らくさん',
  'シュウ酸':'さん',
  '乳酸':'にゅうさん',
  '安息香酸':'あんそくこうさん',
  '酢酸エチル':'さくさん',
  'アクリル酸':'さん',
  '無水酢酸':'むすいさくさん',
  '尿素':'にょうそ',
  'シアン化水素':'かすいそ',
  'サリチル酸':'さん',
  'テレフタル酸':'さん',
  'マロン酸':'さん',
  'コハク酸':'さん',
  'アジピン酸':'さん',
  'リンゴ酸':'さん',
  'クエン酸':'さん',
  'グリコール酸':'さん',
  'サリチル酸メチル':'さん',
  '酢酸イソアミル':'さくさん',
  'ピルビン酸':'さん',
});

export function moleculeNameFuriganaParts(name){
  const value=String(name??'');
  const reading=KANJI_READINGS[value];
  if(!reading)return [{kind:'text',text:value}];
  const match=/[一-龯々]+/u.exec(value);
  if(!match)return [{kind:'text',text:value}];
  const start=match.index,end=start+match[0].length;
  const result=[];
  if(start)result.push({kind:'text',text:value.slice(0,start)});
  result.push({kind:'ruby',text:match[0],reading});
  if(end<value.length)result.push({kind:'text',text:value.slice(end)});
  return result;
}

export function appendNameFuriganaParts(host,parts){
  const doc=host.ownerDocument;
  for(const part of parts){
    if(part.kind!=='ruby'){
      host.append(doc.createTextNode(part.text));
      continue;
    }
    const ruby=doc.createElement('ruby'),rt=doc.createElement('rt');
    ruby.append(doc.createTextNode(part.text));rt.textContent=part.reading;ruby.append(rt);host.append(ruby);
  }
  return host;
}

export function appendMoleculeNameFurigana(host,name){
  return appendNameFuriganaParts(host,moleculeNameFuriganaParts(name));
}
