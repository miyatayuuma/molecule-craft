import {RARE_SURVEY_EVENT} from './rare-survey.js';

const MESSAGE_MS=2600;
const elementName=element=>({P:'リン',S:'硫黄',F:'フッ素',Cl:'塩素'}[element]??element);

export function rareSurveyPresentationText(detail){
  if(detail?.phase==='scan')return {icon:'◇',text:'RARE ANOMALY · 分析中'};
  if(detail?.phase==='collected')return {icon:'◇',text:`${elementName(detail.element)}試料 ${detail.element} +${detail.quantity}\nSPECIMEN HOLD · 正常帰還で確定`};
  return null;
}

export function installRareSurveyPresentation(root=document,target=window){
  const source=root?.getElementById?.('veil-message');if(!source||typeof target?.addEventListener!=='function')return {dispose(){}};
  let node=root.getElementById?.('veil-rare-survey-message');
  if(!node){node=source.cloneNode(false);node.id='veil-rare-survey-message';node.dataset.rareSurvey='true';node.hidden=true;node.style.bottom='334px';source.after(node);}
  let timer=0;
  const show=event=>{
    const message=rareSurveyPresentationText(event?.detail);if(!message)return;
    node.textContent=message.icon;node.setAttribute('aria-label',message.text);node.title=message.text;node.hidden=false;
    clearTimeout(timer);timer=setTimeout(()=>{node.hidden=true;},event.detail.phase==='scan'?1400:MESSAGE_MS);
  };
  target.addEventListener(RARE_SURVEY_EVENT,show);
  return {node,dispose(){clearTimeout(timer);target.removeEventListener(RARE_SURVEY_EVENT,show);node?.remove();}};
}
