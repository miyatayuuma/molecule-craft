// v8.4 safe loader: preserve v8.4 and only fix bond single-vs-double tap arbitration.
const wrapperUrl = new URL('./app-v8-4.js', import.meta.url);
const appUrl = new URL('./app-v8.js', import.meta.url).href;
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(wrapperUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8.4: ${response.status}`);
let code = await response.text();

// The fetched wrapper is evaluated from a Blob, so make its local URLs absolute.
code = code
  .replace("const sourceUrl = new URL('./app-v8.js', import.meta.url);", `const sourceUrl = new URL('${appUrl}');`)
  .replace("const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;", `const chemistryUrl = '${chemistryUrl}';`)
  .replace("const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;", `const bondingUrl = '${bondingUrl}';`);

const oldBlock = `      if(prev&&now-prev<420&&bond&&isRotatableBond(bond)){
        activeTorsionKey=activeTorsionKey===state.key?null:state.key;
        bondTapState.clear();
        pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');
        if(navigator.vibrate)navigator.vibrate(activeTorsionKey?[10,16,18]:10);
      }else{
        bondTapState.set(state.key,now);
        damageBond(state.key);
      }`;

const newBlock = `      if(prev&&now-prev.time<420){
        clearTimeout(prev.timer);
        bondTapState.delete(state.key);
        if(bond&&isRotatableBond(bond)){
          activeTorsionKey=activeTorsionKey===state.key?null:state.key;
          pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');
          if(navigator.vibrate)navigator.vibrate(activeTorsionKey?[10,16,18]:10);
        }else{
          damageBond(state.key);
          setTimeout(()=>damageBond(state.key),60);
        }
      }else{
        if(prev) clearTimeout(prev.timer);
        const timer=setTimeout(()=>{
          const pending=bondTapState.get(state.key);
          if(pending&&pending.timer===timer){
            bondTapState.delete(state.key);
            damageBond(state.key);
          }
        },420);
        bondTapState.set(state.key,{time:now,timer});
      }`;

if (!code.includes(oldBlock)) throw new Error('v8.4 tap arbitration signature not found');
code = code.replace(oldBlock, newBlock);

const blob = new Blob([code], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
