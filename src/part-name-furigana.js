import {appendNameFuriganaParts} from './molecule-name-furigana.js';

export function partNameFuriganaParts(value){
  const name=String(value??'');
  const suffix=name.endsWith('結合')?'結合':name.endsWith('基')?'基':null;
  if(!suffix)return [{kind:'text',text:name}];
  const prefix=name.slice(0,-suffix.length);
  return [
    ...(prefix?[{kind:'text',text:prefix}]:[]),
    {kind:'ruby',text:suffix,reading:suffix==='結合'?'けつごう':'き'},
  ];
}

export function appendPartNameFurigana(host,name){
  return appendNameFuriganaParts(host,partNameFuriganaParts(name));
}
