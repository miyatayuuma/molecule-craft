import { RESET_CATEGORIES } from './resources.js';
export function createProgressResetUI({resources,canReset=()=>true,beforeReset=()=>true,reload=()=>window.location.reload()}){
  const q=id=>document.getElementById(id),status=q('reset-status');
  const labels={collection:'図鑑・部品解放・発見記録',recipes:'分子レシピ',elements:'元素ストック',molecules:'分子ストック',exploration:'H Veilの初回進行',records:'最大CHAIN',workspace:'制作フィールド'};
  function reset(categories,full){
    if(!canReset())return;
    if(!categories.length){status.textContent='初期化する項目を選んでください。';return;}
    const clearsWorkspace=categories.some(key=>['collection','recipes','elements','workspace'].includes(key));
    const detail=full?'図鑑・レシピ・ストック・H Veilの進行と記録・制作途中の分子をすべて消去します。':categories.map(key=>labels[key]).join('、')+'を初期化します。'+(clearsWorkspace?'\n再発見と資源の重複を防ぐため制作フィールドも空にします。元素を初期化しない場合、配置中の原子はストックへ戻します。':'');
    if(!window.confirm(detail+'\n元には戻せません。初期化して再読み込みしますか？'))return;
    if(!resources.blocked&&!beforeReset()){status.textContent='現在の制作を保存できません。保存状態を確認してください。';return;}
    const result=resources.reset(categories);status.textContent=resources.message;
    if(result.committed){q('reset-all').disabled=true;q('reset-selected').disabled=true;reload();}
  }
  q('reset-all').addEventListener('click',()=>reset([...RESET_CATEGORIES],true));
  q('reset-selected').addEventListener('click',()=>reset([...document.querySelectorAll('[name="reset-category"]:checked')].map(node=>node.value),false));
}
