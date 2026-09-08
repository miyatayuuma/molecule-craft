// Waiting updates auto-activate only after the app confirms that its current state is safe to save and reload.
const install=document.getElementById('install-app'),installStatus=document.getElementById('install-status');
const update=document.getElementById('update-app'),updateStatus=document.getElementById('update-status');
const versionStatus=document.createElement('p');versionStatus.id='app-version';versionStatus.className='muted';versionStatus.textContent='APP VERSION —';document.querySelector('#menu-dialog .menu-items')?.append(versionStatus);
let installPrompt=null,registration=null,reloadOnChange=false,lastUpdateCheck=0,updateCheck=null,activationRequested=false;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function installState(){if(standalone()){install.hidden=true;installStatus.textContent='アプリとして起動中';}}
function requestRunningVersion(){
  const worker=navigator.serviceWorker?.controller;if(!worker){versionStatus.textContent='APP VERSION NETWORK';versionStatus.title='Service Worker未制御';return;}
  const channel=new MessageChannel();channel.port1.onmessage=event=>{if(event.data?.type!=='APP_VERSION')return;const id=String(event.data.version??'');versionStatus.textContent=id?`APP VERSION ${id.slice(0,8)}`:'APP VERSION —';versionStatus.title=id;channel.port1.close();};
  try{worker.postMessage({type:'GET_VERSION'},[channel.port2]);}catch{versionStatus.textContent='APP VERSION —';}
}
installState();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(!standalone()){install.hidden=false;installStatus.textContent='ホーム画面からすぐに遊べます。';}});
window.addEventListener('appinstalled',()=>{installPrompt=null;install.hidden=true;installStatus.textContent='インストールしました。';});
install.addEventListener('click',async()=>{
  if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;installStatus.textContent=choice.outcome==='accepted'?'インストールを受け付けました。':'いつでもメニューから追加できます。';}
  else installStatus.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'Safariの共有ボタンから「ホーム画面に追加」を選んでください。':'ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。';
});
function activateWaitingUpdate({manual=false}={}){
  const worker=registration?.waiting;if(!worker||!navigator.serviceWorker.controller)return false;
  const event=new Event('molecule-craft:prepare-update',{cancelable:true});window.dispatchEvent(event);
  if(event.defaultPrevented){update.hidden=false;update.disabled=false;updateStatus.textContent=manual?'操作が終わり、制作途中を保存できてから更新してください。':'新しい版があります。操作が終わると自動で更新します。';return false;}
  if(activationRequested)return true;
  activationRequested=true;reloadOnChange=true;update.hidden=false;update.disabled=true;updateStatus.textContent='更新を準備しています…';worker.postMessage({type:'ACTIVATE_UPDATE'});return true;
}
function ready({auto=true}={}){
  if(!registration?.waiting||!navigator.serviceWorker.controller)return false;
  update.hidden=false;if(auto&&activateWaitingUpdate())return true;
  if(!updateStatus.textContent)updateStatus.textContent='新しい版があります。制作途中を保存して更新できます。';return true;
}
async function checkForUpdate(force=false){
  if(!registration||!navigator.serviceWorker.controller)return;
  if(registration.waiting){ready({auto:true});return;}
  const now=Date.now();if(!force&&now-lastUpdateCheck<5*60*1000)return;
  if(updateCheck)return updateCheck;lastUpdateCheck=now;
  updateCheck=registration.update().then(()=>ready({auto:true})).catch(()=>{}).finally(()=>{updateCheck=null;});return updateCheck;
}
update.addEventListener('click',()=>{if(!registration?.waiting){checkForUpdate(true);return;}activateWaitingUpdate({manual:true});});
if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{activationRequested=false;if(reloadOnChange){location.reload();return;}requestRunningVersion();});
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='UPDATE_BLOCKED'){activationRequested=false;reloadOnChange=false;update.disabled=false;update.hidden=false;updateStatus.textContent='ほかのMolecule Craftの画面を閉じると更新できます。';}
  });
  navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'}).then(reg=>{
    registration=reg;ready({auto:true});requestRunningVersion();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)ready({auto:true});else updateStatus.textContent='オフラインでも遊べる準備ができました。';}if(worker.state==='redundant')updateStatus.textContent=navigator.serviceWorker.controller?'更新の準備を完了できませんでした。現在の版で続けられます。':'オフラインの準備は、次回オンラインで開いたときに再試行します。';});});
    checkForUpdate(true);
  }).catch(()=>{versionStatus.textContent='APP VERSION NETWORK';updateStatus.textContent='この環境ではオフライン機能を利用できません。';});
  window.addEventListener('focus',()=>{requestRunningVersion();if(!ready({auto:true}))checkForUpdate();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){requestRunningVersion();if(!ready({auto:true}))checkForUpdate();}});
}else{versionStatus.textContent='APP VERSION NETWORK';updateStatus.textContent='この環境ではオフライン機能を利用できません。';}
