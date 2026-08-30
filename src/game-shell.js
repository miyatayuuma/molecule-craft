// Dialogs stay outside the 3D renderer, so help and the book also work without WebGL.
export function createGameShell({canOpen=()=>true}={}){
  const q=id=>document.getElementById(id),dialogs=[...document.querySelectorAll('dialog.sheet')];
  function open(id){if(!canOpen())return;for(const dialog of dialogs)if(dialog.open)dialog.close();q(id)?.showModal();}
  for(const [button,id]of [['open-menu','menu-dialog'],['open-help','help-dialog'],['open-info','info-dialog'],['menu-info','info-dialog']])q(button)?.addEventListener('click',()=>open(id));
  for(const dialog of dialogs){
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  }
  q('help-done')?.addEventListener('click',()=>q('help-dialog').close());
  let seen=false;try{seen=localStorage.getItem('molecule-craft.help.v1')==='seen';}catch{}
  if(!seen){q('selection-chip').textContent='原子を置いて、光る点をつないでみよう';q('open-help')?.classList.add('primary');}
  q('help-dialog')?.addEventListener('close',()=>{try{localStorage.setItem('molecule-craft.help.v1','seen');}catch{}q('open-help')?.classList.remove('primary');});
  return {close:()=>dialogs.forEach(dialog=>{if(dialog.open)dialog.close();}),isOpen:()=>dialogs.some(dialog=>dialog.open),closeMenu:()=>q('menu-dialog')?.close()};
}
