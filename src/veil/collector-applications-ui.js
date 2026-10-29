import {ENGINEERING_APPLICATIONS} from '../engineering-fabrication.js';

const EFFECT_LABELS={WEAR_SKIN:'粒子流による減速を軽減',THERMAL_SHELL:'環境からの熱伝達を軽減',CONTROL_INSULATION:'電場による操作低下を軽減'};
export function createCollectorApplicationsUI(resources,supplyDialog){
  const access=document.createElement('button'),dialog=document.createElement('dialog');
  access.type='button';access.id='open-collector-applications';access.textContent='素材';access.setAttribute('aria-label','収集殻の素材を選ぶ');
  supplyDialog.querySelector('.sheet-header h2').after(access);
  dialog.id='collector-applications-dialog';dialog.className='sheet collector-applications';dialog.setAttribute('aria-label','収集殻の素材');
  const header=document.createElement('header');header.className='sheet-header';
  const title=document.createElement('h2');title.textContent='収集殻の素材';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','素材選択を閉じる');close.addEventListener('click',()=>dialog.close());header.append(title,close);
  const body=document.createElement('div');body.className='sheet-body';
  const rows=ENGINEERING_APPLICATIONS.map(({id,nameJa})=>{
    const row=document.createElement('section'),name=document.createElement('strong'),effect=document.createElement('p'),button=document.createElement('button');
    name.textContent=nameJa;effect.textContent=EFFECT_LABELS[id];button.type='button';button.dataset.collectorApplication=id;button.addEventListener('click',()=>{resources.toggleApplication(id);update();});row.append(name,effect,button);body.append(row);return{id,button};
  });
  const status=document.createElement('p');status.setAttribute('role','status');body.append(status);dialog.append(header,body);document.body.append(dialog);
  function update(){
    const {fabricated}=resources.engineeringState(),{activeApplications}=resources.collectorShellState();
    for(const {id,button} of rows){const active=activeApplications[id],available=fabricated[id];button.disabled=!available||resources.blocked;button.dataset.state=active?'active':available?'available':'locked';button.setAttribute('aria-pressed',String(active));button.textContent=active?'適用中 · 解除':available?'装着':'未製作';}
    access.dataset.active=String(Object.values(activeApplications).some(Boolean));status.textContent=resources.message;
  }
  access.addEventListener('click',()=>{update();dialog.showModal();});
  return {update};
}
