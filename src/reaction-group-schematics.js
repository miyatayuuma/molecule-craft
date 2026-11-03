// Small, element-conserving reaction-class schematics.
// Each atom has a persistent identity; bonds are replaced as the atoms move.
// These are representative reactions, not mechanistic intermediates.
const A=(id,kind,x,y,tx=x,ty=y)=>({id,kind,x,y,tx,ty});
const B=(from,to,order=1)=>({from,to,order});
const C=(id,x,y,tx=x,ty=y)=>A(id,'C',x,y,tx,ty);
const O=(id,x,y,tx=x,ty=y)=>A(id,'O',x,y,tx,ty);
const H=(id,x,y,tx=x,ty=y)=>A(id,'H',x,y,tx,ty);
const Cl=(id,x,y,tx=x,ty=y)=>A(id,'Cl',x,y,tx,ty);
const N=(id,x,y,tx=x,ty=y)=>A(id,'N',x,y,tx,ty);
const X=(id,x,y,tx=x,ty=y)=>A(id,'X',x,y,tx,ty);
const Y=(id,x,y,tx=x,ty=y)=>A(id,'Y',x,y,tx,ty);

export const GROUP_SCHEMATIC_DATA=Object.freeze({
 hydrolysis:{
  scale:1.22,
  atoms:[C('a',47,43,47,43),O('b',84,43,84,43),C('c',124,43,170,43),O('d',176,28,132,43),H('e',162,13,105,24),H('f',190,13,140,64)],
  before:[B('a','b'),B('b','c'),B('d','e'),B('d','f')],
  after:[B('a','b'),B('b','e'),B('c','d'),B('d','f')]
 },
 esterification:{
  scale:1.19,
  atoms:[C('a',54,42,61,42),O('b',54,14,61,14),O('c',86,42,169,20),H('d',104,57,182,8),O('e',154,44,100,42),H('f',154,19,181,34),C('g',194,44,137,42)],
  before:[B('a','b',2),B('a','c'),B('c','d'),B('e','f'),B('e','g')],
  after:[B('a','b',2),B('a','e'),B('e','g'),B('c','d'),B('c','f')]
 },
 addition:{
  scale:1.31,
  atoms:[C('a',80,42,79,43),C('b',123,42,126,43),H('c',174,24,67,19),H('d',195,24,140,19)],
  before:[B('a','b',2),B('c','d')],
  after:[B('a','b'),B('a','c'),B('b','d')]
 },
 halogenation:{
  scale:1.30,
  atoms:[C('a',80,43,81,42),C('b',125,43,126,42),Cl('c',177,24,81,15),Cl('d',203,24,126,67)],
  before:[B('a','b',2),B('c','d')],
  after:[B('a','b'),B('a','c'),B('b','d')]
 },
 'ring-opening':{
  scale:1.49,
  atoms:[C('a',84,57,67,49),C('b',120,18,120,22),C('c',156,57,174,49)],
  before:[B('a','b'),B('b','c'),B('a','c')],
  after:[B('a','b'),B('b','c')]
 },
 hydration:{
  scale:1.32,
  atoms:[C('a',58,43,69,43),C('b',108,43,124,43),O('c',177,35,155,24),H('d',163,17,58,22),H('e',192,17,175,11)],
  before:[B('a','b',2),B('c','d'),B('c','e')],
  after:[B('a','b'),B('a','d'),B('b','c'),B('c','e')]
 },
 substitution:{
  scale:1.48,
  atoms:[C('a',74,43,74,43),X('b',113,43,175,28),Y('c',169,43,113,43),H('d',197,43,198,28)],
  before:[B('a','b'),B('c','d')],
  after:[B('a','c'),B('b','d')]
 },
 cycloaddition:{
  scale:1.47,
  atoms:[C('a',69,29,87,20),C('b',102,29,87,59),C('c',143,50,145,20),C('d',176,50,145,59)],
  before:[B('a','b',2),B('c','d',2)],
  after:[B('a','b'),B('a','c'),B('b','d'),B('c','d')]
 },
 oxidation:{
  scale:1.43,
  atoms:[C('a',97,43,89,43),O('b',135,43,129,43),H('c',155,28,174,24),O('d',192,38,187,44),H('e',96,18,201,26)],
  before:[B('a','b'),B('b','c'),B('a','e')],
  after:[B('a','b',2),B('d','c'),B('d','e')]
 },
 dehydration:{
  scale:1.30,
  atoms:[C('a',70,43,58,43),C('b',124,43,108,43),O('c',155,23,176,35),H('d',58,21,162,18),H('e',176,11,191,18)],
  before:[B('a','b'),B('a','d'),B('b','c'),B('c','e')],
  after:[B('a','b',2),B('c','d'),B('c','e')]
 },
 condensation:{
  scale:1.19,
  atoms:[C('a',61,43,61,43),O('b',61,15,61,15),O('c',97,43,170,20),H('d',112,59,183,8),N('e',155,43,101,43),H('f',155,18,184,34),C('g',196,43,139,43)],
  before:[B('a','b',2),B('a','c'),B('c','d'),B('e','f'),B('e','g')],
  after:[B('a','b',2),B('a','e'),B('e','g'),B('c','d'),B('c','f')]
 },
 combustion:{
  scale:1.18,flame:true,
  atoms:[C('a',69,44,120,43),O('b',153,35,82,43),O('c',181,35,158,43)],
  before:[B('b','c',2)],
  after:[B('a','b',2),B('a','c',2)]
 },
 polymerization:{
  scale:1.16,
  atoms:[C('a',38,40,30,40),C('b',66,40,63,40),C('c',110,40,96,40),C('d',138,40,129,40),C('e',182,40,162,40),C('f',210,40,195,40)],
  before:[B('a','b',2),B('c','d',2),B('e','f',2)],
  after:[B('a','b'),B('b','c'),B('c','d'),B('d','e'),B('e','f')]
 },
 other:{
  scale:1.14,other:true,
  atoms:[C('a',40,49),O('b',69,30),C('c',112,50),C('d',140,50),O('e',185,33),H('f',207,49)],
  before:[B('a','b'),B('c','d',2),B('e','f')],
  after:[B('a','b'),B('c','d',2),B('e','f')]
 }
});
const RADII={C:11.5,O:10.5,H:6.5,Cl:12,N:10.5,X:11.5,Y:11.5};
const COLORS={C:'#9db3c3',O:'#f27b7d',H:'#eef5f8',Cl:'#6bd2a0',N:'#7cb6ee',X:'#bca5df',Y:'#7bdaa2'};
function bondSvg(a,b,order,final,mark){
 const x1=final?a.tx:a.x,y1=final?a.ty:a.y,x2=final?b.tx:b.x,y2=final?b.ty:b.y;
 const dx=x2-x1,dy=y2-y1,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist;
 const start=Math.min(dist/3,RADII[a.kind]*.77),end=Math.min(dist/3,RADII[b.kind]*.77);
 const ax=x1+ux*start,ay=y1+uy*start,bx=x2-ux*end,by=y2-uy*end;
 const color=mark==='new'?'#86e4b7':mark==='broken'?'#edc277':'#d8e6ed';
 const lane=order===2?2.8:0;
 const line=offset=>{
   const px=-uy*offset,py=ux*offset;
   return '<path d="M'+(ax+px).toFixed(2)+' '+(ay+py).toFixed(2)+'L'+(bx+px).toFixed(2)+' '+(by+py).toFixed(2)+'" stroke="'+color+'" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
 };
 return order===2?line(-lane)+line(lane):line(0);
}
// Use a compact portrait layout without shrinking individual atoms.
const compactX=x=>120+(x-120)*.76;
const compactY=y=>39+(y-39)*1.3;
const compactMarkup=markup=>'<g transform="translate(120 39) scale(.76 1.3) translate(-120 -39)">'+markup+'</g>';
function render(def){
 const points=def.atoms.map(a=>({...a,x:compactX(a.x),y:compactY(a.y),tx:compactX(a.tx),ty:compactY(a.ty)}));
 const refs=new Map(points.map(a=>[a.id,a]));
 if(refs.size!==points.length)throw Error('Duplicate schematic atom ID');
 const key=b=>[...([b.from,b.to].sort()),b.order].join(':');
 const beforeKeys=new Set(def.before.map(key)),afterKeys=new Set(def.after.map(key));
 const bonds=(set,final)=>set.map(b=>{
  const a=refs.get(b.from),c=refs.get(b.to);
  if(!a||!c)throw Error('Unknown schematic atom');
  return bondSvg(a,c,b.order,final,final?beforeKeys.has(key(b))?'base':'new':afterKeys.has(key(b))?'base':'broken');
 }).join('');
 const atoms=points.map(a=>{
  const dx=a.tx-a.x,dy=a.ty-a.y,r=RADII[a.kind];
  return '<g class="rb-schem-atom" style="--rb-dx:'+dx+'px;--rb-dy:'+dy+'px"><circle cx="'+a.x+'" cy="'+a.y+'" r="'+r+'" fill="'+COLORS[a.kind]+'" stroke="#d9e8ef" stroke-opacity=".28" stroke-width="1"/><circle cx="'+(a.x-r*.29)+'" cy="'+(a.y-r*.32)+'" r="'+(r*.27)+'" fill="#fff" fill-opacity=".25"/></g>';
 }).join('');
 const flame=def.flame?compactMarkup('<path class="rb-schem-fire" d="M211 65Q199 52 210 38Q219 50 225 26Q245 52 230 65Z" fill="#f2ad5a" fill-opacity=".88"/>'):'';
 // "Other" deliberately shows distinct miniatures, not a fictitious shared mechanism.
 const framing=def.other?compactMarkup('<path d="M91 20V61M164 20V61" stroke="#718b9c" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="3 5"/>'):'';
 return '<g class="rb-schem-scene" transform="translate(120 39) scale('+def.scale+') translate(-120 -39)">'+
  '<g class="rb-schem-before">'+bonds(def.before,false)+'</g>'+
  '<g class="rb-schem-after">'+bonds(def.after,true)+flame+'</g>'+
  atoms+framing+'</g>';
}
export const GROUP_GRAPHICS=Object.freeze(Object.fromEntries(
 Object.entries(GROUP_SCHEMATIC_DATA).map(([id,def])=>[id,render(def)])
));
