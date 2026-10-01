export function clone(v,seen=new Map()){if(!v||typeof v!=='object')return v;if(seen.has(v))return seen.get(v);const o=Array.isArray(v)?[]:{};seen.set(v,o);for(const [k,item]of Object.entries(v))o[k]=clone(item,seen);return o;}
export function spy(factory){
  let id=0,gradientId=0;const calls=[];
  const normalize=a=>a&&typeof a==='object'?(a.canvasId!==undefined?`canvas:${a.canvasId}`:`gradient:${a.gradientId}`):a;
  const makeCanvas=()=>{const canvas={canvasId:id++,width:0,height:0,getBoundingClientRect:()=>({width:390,height:844})};const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{if(canvas.canvasId===0)calls.push([key,...args.map(normalize)]);if(key==='createRadialGradient'||key==='createLinearGradient'){const g={gradientId:gradientId++,addColorStop(...args){if(canvas.canvasId===0)calls.push(['addColorStop',g.gradientId,...args]);}};return g;}},set:(target,key,value)=>{target[key]=value;if(canvas.canvasId===0)calls.push(['set',key,normalize(value)]);return true;}});canvas.getContext=()=>ctx;return canvas;};
  globalThis.document={createElement:makeCanvas};globalThis.window={devicePixelRatio:2};const renderer=factory(makeCanvas());return {renderer,calls,clear(){calls.length=0;}};
}
