import{Triangle as Ts,Vector3 as oi,ShaderChunk as As,Object3D as vi,Mesh as Xi,Layers as Ce,PlaneGeometry as Ns,MeshBasicMaterial as Ji,DoubleSide as Li,AdditiveBlending as Yi,MeshStandardMaterial as Es,MeshPhysicalMaterial as Ps,InstancedBufferAttribute as lt,DynamicDrawUsage as L,InstancedBufferGeometry as Cs,Uniform as tt,ShaderMaterial as li,BufferGeometry as Us,BufferAttribute as mt,Group as Hi,Clock as Bs,AnimationMixer as Rs,LoopOnce as ks,ObjectLoader as Fs,Bone as Is,Sprite as Vs,Points as Js,LineSegments as Ls,LineLoop as Ds,Line as Gs,LOD as qs,BatchedMesh as Xs,Box3 as Ys,Sphere as Hs,InstancedMesh as Zs,SkinnedMesh as Ws,LightProbe as Qs,HemisphereLight as Ks,SpotLight as $s,RectAreaLight as js,PointLight as tr,DirectionalLight as er,AmbientLight as ir,OrthographicCamera as sr,PerspectiveCamera as rr,Scene as nr,Color as or,Fog as ar,FogExp2 as hr}from"three";var I=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],_i=1234567,Ei=Math.PI/180,Pi=180/Math.PI;function Zi(){let o=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(I[o&255]+I[o>>8&255]+I[o>>16&255]+I[o>>24&255]+"-"+I[t&255]+I[t>>8&255]+"-"+I[t>>16&15|64]+I[t>>24&255]+"-"+I[e&63|128]+I[e>>8&255]+"-"+I[e>>16&255]+I[e>>24&255]+I[i&255]+I[i>>8&255]+I[i>>16&255]+I[i>>24&255]).toLowerCase()}function st(o,t,e){return Math.max(t,Math.min(e,o))}function Ci(o,t){return(o%t+t)%t}function Wi(o,t,e,i,s){return i+(o-t)*(s-i)/(e-t)}function Qi(o,t,e){return o!==t?(e-o)/(t-o):0}function Ui(o,t,e){return(1-e)*o+e*t}function Ki(o,t,e,i){return Ui(o,t,1-Math.exp(-e*i))}function $i(o,t=1){return t-Math.abs(Ci(o,t*2)-t)}function ji(o,t,e){return o<=t?0:o>=e?1:(o=(o-t)/(e-t),o*o*(3-2*o))}function ts(o,t,e){return o<=t?0:o>=e?1:(o=(o-t)/(e-t),o*o*o*(o*(o*6-15)+10))}function es(o,t){return o+Math.floor(Math.random()*(t-o+1))}function is(o,t){return o+Math.random()*(t-o)}function ss(o){return o*(.5-Math.random())}function rs(o){o!==void 0&&(_i=o);let t=_i+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function ns(o){return o*Ei}function os(o){return o*Pi}function as(o){return(o&o-1)===0&&o!==0}function hs(o){return Math.pow(2,Math.ceil(Math.log(o)/Math.LN2))}function ls(o){return Math.pow(2,Math.floor(Math.log(o)/Math.LN2))}function cs(o,t,e,i,s){let r=Math.cos,n=Math.sin,h=r(e/2),a=n(e/2),l=r((t+i)/2),c=n((t+i)/2),u=r((t-i)/2),f=n((t-i)/2),d=r((i-t)/2),m=n((i-t)/2);switch(s){case"XYX":o.set(h*c,a*u,a*f,h*l);break;case"YZY":o.set(a*f,h*c,a*u,h*l);break;case"ZXZ":o.set(a*u,a*f,h*c,h*l);break;case"XZX":o.set(h*c,a*m,a*d,h*l);break;case"YXY":o.set(a*d,h*c,a*m,h*l);break;case"ZYZ":o.set(a*m,a*d,h*c,h*l);break;default:console.warn("../math.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function us(o,t){switch(t.constructor){case Float32Array:return o;case Uint32Array:return o/4294967295;case Uint16Array:return o/65535;case Uint8Array:return o/255;case Int32Array:return Math.max(o/2147483647,-1);case Int16Array:return Math.max(o/32767,-1);case Int8Array:return Math.max(o/127,-1);default:throw new Error("Invalid component type.")}}function ds(o,t){switch(t.constructor){case Float32Array:return o;case Uint32Array:return Math.round(o*4294967295);case Uint16Array:return Math.round(o*65535);case Uint8Array:return Math.round(o*255);case Int32Array:return Math.round(o*2147483647);case Int16Array:return Math.round(o*32767);case Int8Array:return Math.round(o*127);default:throw new Error("Invalid component type.")}}var Ot={DEG2RAD:Ei,RAD2DEG:Pi,generateUUID:Zi,clamp:st,euclideanModulo:Ci,mapLinear:Wi,inverseLerp:Qi,lerp:Ui,damp:Ki,pingpong:$i,smoothstep:ji,smootherstep:ts,randInt:es,randFloat:is,randFloatSpread:ss,seededRandom:rs,degToRad:ns,radToDeg:os,isPowerOfTwo:as,ceilPowerOfTwo:hs,floorPowerOfTwo:ls,setQuaternionFromProperEuler:cs,normalize:ds,denormalize:us},A=class o{constructor(t=0,e=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=s}static slerpFlat(t,e,i,s,r,n,h){let a=i[s+0],l=i[s+1],c=i[s+2],u=i[s+3],f=r[n+0],d=r[n+1],m=r[n+2],p=r[n+3];if(h===0){t[e+0]=a,t[e+1]=l,t[e+2]=c,t[e+3]=u;return}if(h===1){t[e+0]=f,t[e+1]=d,t[e+2]=m,t[e+3]=p;return}if(u!==p||a!==f||l!==d||c!==m){let y=1-h,x=a*f+l*d+c*m+u*p,z=x>=0?1:-1,b=1-x*x;if(b>Number.EPSILON){let M=Math.sqrt(b),g=Math.atan2(M,x*z);y=Math.sin(y*g)/M,h=Math.sin(h*g)/M}let w=h*z;if(a=a*y+f*w,l=l*y+d*w,c=c*y+m*w,u=u*y+p*w,y===1-h){let M=1/Math.sqrt(a*a+l*l+c*c+u*u);a*=M,l*=M,c*=M,u*=M}}t[e]=a,t[e+1]=l,t[e+2]=c,t[e+3]=u}static multiplyQuaternionsFlat(t,e,i,s,r,n){let h=i[s],a=i[s+1],l=i[s+2],c=i[s+3],u=r[n],f=r[n+1],d=r[n+2],m=r[n+3];return t[e]=h*m+c*u+a*d-l*f,t[e+1]=a*m+c*f+l*u-h*d,t[e+2]=l*m+c*d+h*f-a*u,t[e+3]=c*m-h*u-a*f-l*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,s){return this._x=t,this._y=e,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new o(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let i=t._x,s=t._y,r=t._z,n=t._order,h=Math.cos,a=Math.sin,l=h(i/2),c=h(s/2),u=h(r/2),f=a(i/2),d=a(s/2),m=a(r/2);switch(n){case"XYZ":this._x=f*c*u+l*d*m,this._y=l*d*u-f*c*m,this._z=l*c*m+f*d*u,this._w=l*c*u-f*d*m;break;case"YXZ":this._x=f*c*u+l*d*m,this._y=l*d*u-f*c*m,this._z=l*c*m-f*d*u,this._w=l*c*u+f*d*m;break;case"ZXY":this._x=f*c*u-l*d*m,this._y=l*d*u+f*c*m,this._z=l*c*m+f*d*u,this._w=l*c*u-f*d*m;break;case"ZYX":this._x=f*c*u-l*d*m,this._y=l*d*u+f*c*m,this._z=l*c*m-f*d*u,this._w=l*c*u+f*d*m;break;case"YZX":this._x=f*c*u+l*d*m,this._y=l*d*u+f*c*m,this._z=l*c*m-f*d*u,this._w=l*c*u-f*d*m;break;case"XZY":this._x=f*c*u-l*d*m,this._y=l*d*u-f*c*m,this._z=l*c*m+f*d*u,this._w=l*c*u+f*d*m;break;default:console.warn("../math.Quaternion: .setFromEuler() encountered an unknown order: "+n)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let i=e/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,i=e[0],s=e[4],r=e[8],n=e[1],h=e[5],a=e[9],l=e[2],c=e[6],u=e[10],f=i+h+u;if(f>0){let d=.5/Math.sqrt(f+1);this._w=.25/d,this._x=(c-a)*d,this._y=(r-l)*d,this._z=(n-s)*d}else if(i>h&&i>u){let d=2*Math.sqrt(1+i-h-u);this._w=(c-a)/d,this._x=.25*d,this._y=(s+n)/d,this._z=(r+l)/d}else if(h>u){let d=2*Math.sqrt(1+h-i-u);this._w=(r-l)/d,this._x=(s+n)/d,this._y=.25*d,this._z=(a+c)/d}else{let d=2*Math.sqrt(1+u-i-h);this._w=(n-s)/d,this._x=(r+l)/d,this._y=(a+c)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<Number.EPSILON?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(st(this.dot(t),-1,1)))}rotateTowards(t,e){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,e/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let i=t._x,s=t._y,r=t._z,n=t._w,h=e._x,a=e._y,l=e._z,c=e._w;return this._x=i*c+n*h+s*l-r*a,this._y=s*c+n*a+r*h-i*l,this._z=r*c+n*l+i*a-s*h,this._w=n*c-i*h-s*a-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);let i=this._x,s=this._y,r=this._z,n=this._w,h=n*t._w+i*t._x+s*t._y+r*t._z;if(h<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,h=-h):this.copy(t),h>=1)return this._w=n,this._x=i,this._y=s,this._z=r,this;let a=1-h*h;if(a<=Number.EPSILON){let d=1-e;return this._w=d*n+e*this._w,this._x=d*i+e*this._x,this._y=d*s+e*this._y,this._z=d*r+e*this._z,this.normalize(),this}let l=Math.sqrt(a),c=Math.atan2(l,h),u=Math.sin((1-e)*c)/l,f=Math.sin(e*c)/l;return this._w=n*u+this._w*f,this._x=i*u+this._x*f,this._y=s*u+this._y*f,this._z=r*u+this._z*f,this._onChangeCallback(),this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},v=class o{constructor(t=0,e=0,i=0){this.isVector3=!0,o.prototype.isVector3=!0,this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new o(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(wi.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(wi.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,i=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6]*s,this.y=r[1]*e+r[4]*i+r[7]*s,this.z=r[2]*e+r[5]*i+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,i=this.y,s=this.z,r=t.elements,n=1/(r[3]*e+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*i+r[8]*s+r[12])*n,this.y=(r[1]*e+r[5]*i+r[9]*s+r[13])*n,this.z=(r[2]*e+r[6]*i+r[10]*s+r[14])*n,this}applyQuaternion(t){let e=this.x,i=this.y,s=this.z,r=t.x,n=t.y,h=t.z,a=t.w,l=2*(n*s-h*i),c=2*(h*e-r*s),u=2*(r*i-n*e);return this.x=e+a*l+n*u-h*c,this.y=i+a*c+h*l-r*u,this.z=s+a*u+r*c-n*l,this}transformDirection(t){let e=this.x,i=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*i+r[8]*s,this.y=r[1]*e+r[5]*i+r[9]*s,this.z=r[2]*e+r[6]*i+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let i=t.x,s=t.y,r=t.z,n=e.x,h=e.y,a=e.z;return this.x=s*a-r*h,this.y=r*n-i*a,this.z=i*h-s*n,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return Ze.copy(this).projectOnVector(t),this.sub(Ze)}reflect(t){return this.sub(Ze.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(st(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return e*e+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSphericalCoords(t,e,i){let s=Math.sin(e)*t;return this.x=s*Math.sin(i),this.y=Math.cos(e)*t,this.z=s*Math.cos(i),this}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}abs(){return this.x=Math.abs(this.x),this.y=Math.abs(this.y),this.z=Math.abs(this.z),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ze=new v,wi=new A,Wt=2e3,zi=2001,rt=class o{constructor(t,e,i,s,r,n,h,a,l,c,u,f,d,m,p,y){this.isMatrix4=!0,o.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,s,r,n,h,a,l,c,u,f,d,m,p,y)}extractPosition(t){return console.warn("THREE.Matrix4: .extractPosition() has been renamed to .copyPosition()."),this.copyPosition(t)}multiplyToArray(t,e,i){return console.error("THREE.Matrix4: .multiplyToArray() has been removed."),this}setRotationFromQuaternion(t){return this.makeRotationFromQuaternion(t)}set(t,e,i,s,r,n,h,a,l,c,u,f,d,m,p,y){let x=this.elements;return x[0]=t,x[4]=e,x[8]=i,x[12]=s,x[1]=r,x[5]=n,x[9]=h,x[13]=a,x[2]=l,x[6]=c,x[10]=u,x[14]=f,x[3]=d,x[7]=m,x[11]=p,x[15]=y,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new o().fromArray(this.elements)}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){let e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){let e=this.elements,i=t.elements,s=1/yt.setFromMatrixColumn(t,0).length(),r=1/yt.setFromMatrixColumn(t,1).length(),n=1/yt.setFromMatrixColumn(t,2).length();return e[0]=i[0]*s,e[1]=i[1]*s,e[2]=i[2]*s,e[3]=0,e[4]=i[4]*r,e[5]=i[5]*r,e[6]=i[6]*r,e[7]=0,e[8]=i[8]*n,e[9]=i[9]*n,e[10]=i[10]*n,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,i=t.x,s=t.y,r=t.z,n=Math.cos(i),h=Math.sin(i),a=Math.cos(s),l=Math.sin(s),c=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){let f=n*c,d=n*u,m=h*c,p=h*u;e[0]=a*c,e[4]=-a*u,e[8]=l,e[1]=d+m*l,e[5]=f-p*l,e[9]=-h*a,e[2]=p-f*l,e[6]=m+d*l,e[10]=n*a}else if(t.order==="YXZ"){let f=a*c,d=a*u,m=l*c,p=l*u;e[0]=f+p*h,e[4]=m*h-d,e[8]=n*l,e[1]=n*u,e[5]=n*c,e[9]=-h,e[2]=d*h-m,e[6]=p+f*h,e[10]=n*a}else if(t.order==="ZXY"){let f=a*c,d=a*u,m=l*c,p=l*u;e[0]=f-p*h,e[4]=-n*u,e[8]=m+d*h,e[1]=d+m*h,e[5]=n*c,e[9]=p-f*h,e[2]=-n*l,e[6]=h,e[10]=n*a}else if(t.order==="ZYX"){let f=n*c,d=n*u,m=h*c,p=h*u;e[0]=a*c,e[4]=m*l-d,e[8]=f*l+p,e[1]=a*u,e[5]=p*l+f,e[9]=d*l-m,e[2]=-l,e[6]=h*a,e[10]=n*a}else if(t.order==="YZX"){let f=n*a,d=n*l,m=h*a,p=h*l;e[0]=a*c,e[4]=p-f*u,e[8]=m*u+d,e[1]=u,e[5]=n*c,e[9]=-h*c,e[2]=-l*c,e[6]=d*u+m,e[10]=f-p*u}else if(t.order==="XZY"){let f=n*a,d=n*l,m=h*a,p=h*l;e[0]=a*c,e[4]=-u,e[8]=l*c,e[1]=f*u+p,e[5]=n*c,e[9]=d*u-m,e[2]=m*u-d,e[6]=h*c,e[10]=p*u+f}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(ms,t,fs)}lookAt(t,e,i){let s=this.elements;return G.subVectors(t,e),G.lengthSq()===0&&(G.z=1),G.normalize(),dt.crossVectors(i,G),dt.lengthSq()===0&&(Math.abs(i.z)===1?G.x+=1e-4:G.z+=1e-4,G.normalize(),dt.crossVectors(i,G)),dt.normalize(),Qt.crossVectors(G,dt),s[0]=dt.x,s[4]=Qt.x,s[8]=G.x,s[1]=dt.y,s[5]=Qt.y,s[9]=G.y,s[2]=dt.z,s[6]=Qt.z,s[10]=G.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,s=e.elements,r=this.elements,n=i[0],h=i[4],a=i[8],l=i[12],c=i[1],u=i[5],f=i[9],d=i[13],m=i[2],p=i[6],y=i[10],x=i[14],z=i[3],b=i[7],w=i[11],M=i[15],g=s[0],S=s[4],O=s[8],E=s[12],P=s[1],C=s[5],J=s[9],Y=s[13],H=s[2],Z=s[6],W=s[10],Q=s[14],K=s[3],$=s[7],q=s[11],X=s[15];return r[0]=n*g+h*P+a*H+l*K,r[4]=n*S+h*C+a*Z+l*$,r[8]=n*O+h*J+a*W+l*q,r[12]=n*E+h*Y+a*Q+l*X,r[1]=c*g+u*P+f*H+d*K,r[5]=c*S+u*C+f*Z+d*$,r[9]=c*O+u*J+f*W+d*q,r[13]=c*E+u*Y+f*Q+d*X,r[2]=m*g+p*P+y*H+x*K,r[6]=m*S+p*C+y*Z+x*$,r[10]=m*O+p*J+y*W+x*q,r[14]=m*E+p*Y+y*Q+x*X,r[3]=z*g+b*P+w*H+M*K,r[7]=z*S+b*C+w*Z+M*$,r[11]=z*O+b*J+w*W+M*q,r[15]=z*E+b*Y+w*Q+M*X,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[4],s=t[8],r=t[12],n=t[1],h=t[5],a=t[9],l=t[13],c=t[2],u=t[6],f=t[10],d=t[14],m=t[3],p=t[7],y=t[11],x=t[15];return m*(+r*a*u-s*l*u-r*h*f+i*l*f+s*h*d-i*a*d)+p*(+e*a*d-e*l*f+r*n*f-s*n*d+s*l*c-r*a*c)+y*(+e*l*u-e*h*d-r*n*u+i*n*d+r*h*c-i*l*c)+x*(-s*h*c-e*a*u+e*h*f+s*n*u-i*n*f+i*a*c)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=i),this}invert(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],n=t[4],h=t[5],a=t[6],l=t[7],c=t[8],u=t[9],f=t[10],d=t[11],m=t[12],p=t[13],y=t[14],x=t[15],z=u*y*l-p*f*l+p*a*d-h*y*d-u*a*x+h*f*x,b=m*f*l-c*y*l-m*a*d+n*y*d+c*a*x-n*f*x,w=c*p*l-m*u*l+m*h*d-n*p*d-c*h*x+n*u*x,M=m*u*a-c*p*a-m*h*f+n*p*f+c*h*y-n*u*y,g=e*z+i*b+s*w+r*M;if(g===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let S=1/g;return t[0]=z*S,t[1]=(p*f*r-u*y*r-p*s*d+i*y*d+u*s*x-i*f*x)*S,t[2]=(h*y*r-p*a*r+p*s*l-i*y*l-h*s*x+i*a*x)*S,t[3]=(u*a*r-h*f*r-u*s*l+i*f*l+h*s*d-i*a*d)*S,t[4]=b*S,t[5]=(c*y*r-m*f*r+m*s*d-e*y*d-c*s*x+e*f*x)*S,t[6]=(m*a*r-n*y*r-m*s*l+e*y*l+n*s*x-e*a*x)*S,t[7]=(n*f*r-c*a*r+c*s*l-e*f*l-n*s*d+e*a*d)*S,t[8]=w*S,t[9]=(m*u*r-c*p*r-m*i*d+e*p*d+c*i*x-e*u*x)*S,t[10]=(n*p*r-m*h*r+m*i*l-e*p*l-n*i*x+e*h*x)*S,t[11]=(c*h*r-n*u*r-c*i*l+e*u*l+n*i*d-e*h*d)*S,t[12]=M*S,t[13]=(c*p*s-m*u*s+m*i*f-e*p*f-c*i*y+e*u*y)*S,t[14]=(m*h*s-n*p*s-m*i*a+e*p*a+n*i*y-e*h*y)*S,t[15]=(n*u*s-c*h*s+c*i*a-e*u*a-n*i*f+e*h*f)*S,this}scale(t){let e=this.elements,i=t.x,s=t.y,r=t.z;return e[0]*=i,e[4]*=s,e[8]*=r,e[1]*=i,e[5]*=s,e[9]*=r,e[2]*=i,e[6]*=s,e[10]*=r,e[3]*=i,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,s))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let i=Math.cos(e),s=Math.sin(e),r=1-i,n=t.x,h=t.y,a=t.z,l=r*n,c=r*h;return this.set(l*n+i,l*h-s*a,l*a+s*h,0,l*h+s*a,c*h+i,c*a-s*n,0,l*a-s*h,c*a+s*n,r*a*a+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,s,r,n){return this.set(1,i,r,0,t,1,n,0,e,s,1,0,0,0,0,1),this}compose(t,e,i){let s=this.elements,r=e._x,n=e._y,h=e._z,a=e._w,l=r+r,c=n+n,u=h+h,f=r*l,d=r*c,m=r*u,p=n*c,y=n*u,x=h*u,z=a*l,b=a*c,w=a*u,M=i.x,g=i.y,S=i.z;return s[0]=(1-(p+x))*M,s[1]=(d+w)*M,s[2]=(m-b)*M,s[3]=0,s[4]=(d-w)*g,s[5]=(1-(f+x))*g,s[6]=(y+z)*g,s[7]=0,s[8]=(m+b)*S,s[9]=(y-z)*S,s[10]=(1-(f+p))*S,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,i){let s=this.elements,r=yt.set(s[0],s[1],s[2]).length(),n=yt.set(s[4],s[5],s[6]).length(),h=yt.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],j.copy(this);let l=1/r,c=1/n,u=1/h;return j.elements[0]*=l,j.elements[1]*=l,j.elements[2]*=l,j.elements[4]*=c,j.elements[5]*=c,j.elements[6]*=c,j.elements[8]*=u,j.elements[9]*=u,j.elements[10]*=u,e.setFromRotationMatrix(j),i.x=r,i.y=n,i.z=h,this}makePerspective(t,e,i,s,r,n,h=Wt){let a=this.elements,l=2*r/(e-t),c=2*r/(i-s),u=(e+t)/(e-t),f=(i+s)/(i-s),d,m;if(h===Wt)d=-(n+r)/(n-r),m=-2*n*r/(n-r);else if(h===zi)d=-n/(n-r),m=-n*r/(n-r);else throw new Error("Matrix4.makePerspective(): Invalid coordinate system: "+h);return a[0]=l,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=c,a[9]=f,a[13]=0,a[2]=0,a[6]=0,a[10]=d,a[14]=m,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(t,e,i,s,r,n,h=Wt){let a=this.elements,l=1/(e-t),c=1/(i-s),u=1/(n-r),f=(e+t)*l,d=(i+s)*c,m,p;if(h===Wt)m=(n+r)*u,p=-2*u;else if(h===zi)m=r*u,p=-1*u;else throw new Error("../math.Matrix4.makeOrthographic(): Invalid coordinate system: "+h);return a[0]=2*l,a[4]=0,a[8]=0,a[12]=-f,a[1]=0,a[5]=2*c,a[9]=0,a[13]=-d,a[2]=0,a[6]=0,a[10]=p,a[14]=-m,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(t){let e=this.elements,i=t.elements;for(let s=0;s<16;s++)if(e[s]!==i[s])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}},yt=new v,j=new rt,ms=new v(0,0,0),fs=new v(1,1,1),dt=new v,Qt=new v,G=new v,bi=new rt,Oi=new A,jt=class o{constructor(t=0,e=0,i=0,s=o.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,s=this._order){return this._x=t,this._y=e,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new o(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){let s=t.elements,r=s[0],n=s[4],h=s[8],a=s[1],l=s[5],c=s[9],u=s[2],f=s[6],d=s[10];switch(e){case"XYZ":this._y=Math.asin(st(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(-c,d),this._z=Math.atan2(-n,r)):(this._x=Math.atan2(f,l),this._z=0);break;case"YXZ":this._x=Math.asin(-st(c,-1,1)),Math.abs(c)<.9999999?(this._y=Math.atan2(h,d),this._z=Math.atan2(a,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(st(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-n,l)):(this._y=0,this._z=Math.atan2(a,r));break;case"ZYX":this._y=Math.asin(-st(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,d),this._z=Math.atan2(a,r)):(this._x=0,this._z=Math.atan2(-n,l));break;case"YZX":this._z=Math.asin(st(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-c,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(h,d));break;case"XZY":this._z=Math.asin(-st(n,-1,1)),Math.abs(n)<.9999999?(this._x=Math.atan2(f,l),this._y=Math.atan2(h,r)):(this._x=Math.atan2(-c,d),this._y=0);break;default:console.warn("../math.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return bi.makeRotationFromQuaternion(t),this.setFromRotationMatrix(bi,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Oi.setFromEuler(this),this.setFromQuaternion(Oi,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(t){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};jt.DEFAULT_ORDER="XYZ";var ht=class o{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new o(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,i=this.y,s=t.elements;return this.x=s[0]*e+s[3]*i+s[6],this.y=s[1]*e+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(st(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}rotateAround(t,e){let i=Math.cos(e),s=Math.sin(e),r=this.x-t.x,n=this.y-t.y;return this.x=r*i-n*s+t.x,this.y=r*s+n*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};ht.isVector2=!0;var D=class o{constructor(t=0,e=0,i=0,s=1){o.prototype.isVector4=!0,this.x=t,this.y=e,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,s){return this.x=t,this.y=e,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new o(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,i=this.y,s=this.z,r=this.w,n=t.elements;return this.x=n[0]*e+n[4]*i+n[8]*s+n[12]*r,this.y=n[1]*e+n[5]*i+n[9]*s+n[13]*r,this.z=n[2]*e+n[6]*i+n[10]*s+n[14]*r,this.w=n[3]*e+n[7]*i+n[11]*s+n[15]*r,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,s,r,a=t.elements,l=a[0],c=a[4],u=a[8],f=a[1],d=a[5],m=a[9],p=a[2],y=a[6],x=a[10];if(Math.abs(c-f)<.01&&Math.abs(u-p)<.01&&Math.abs(m-y)<.01){if(Math.abs(c+f)<.1&&Math.abs(u+p)<.1&&Math.abs(m+y)<.1&&Math.abs(l+d+x-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let b=(l+1)/2,w=(d+1)/2,M=(x+1)/2,g=(c+f)/4,S=(u+p)/4,O=(m+y)/4;return b>w&&b>M?b<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(b),s=g/i,r=S/i):w>M?w<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(w),i=g/s,r=O/s):M<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(M),i=S/r,s=O/r),this.set(i,s,r,e),this}let z=Math.sqrt((y-m)*(y-m)+(u-p)*(u-p)+(f-c)*(f-c));return Math.abs(z)<.001&&(z=1),this.x=(y-m)/z,this.y=(u-p)/z,this.z=(f-c)/z,this.w=Math.acos((l+d+x-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},nt=class o{constructor(t,e,i,s,r,n,h,a,l){o.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,s,r,n,h,a,l)}set(t,e,i,s,r,n,h,a,l){let c=this.elements;return c[0]=t,c[1]=s,c[2]=h,c[3]=e,c[4]=r,c[5]=a,c[6]=i,c[7]=n,c[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,s=e.elements,r=this.elements,n=i[0],h=i[3],a=i[6],l=i[1],c=i[4],u=i[7],f=i[2],d=i[5],m=i[8],p=s[0],y=s[3],x=s[6],z=s[1],b=s[4],w=s[7],M=s[2],g=s[5],S=s[8];return r[0]=n*p+h*z+a*M,r[3]=n*y+h*b+a*g,r[6]=n*x+h*w+a*S,r[1]=l*p+c*z+u*M,r[4]=l*y+c*b+u*g,r[7]=l*x+c*w+u*S,r[2]=f*p+d*z+m*M,r[5]=f*y+d*b+m*g,r[8]=f*x+d*w+m*S,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],n=t[4],h=t[5],a=t[6],l=t[7],c=t[8];return e*n*c-e*h*l-i*r*c+i*h*a+s*r*l-s*n*a}invert(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],n=t[4],h=t[5],a=t[6],l=t[7],c=t[8],u=c*n-h*l,f=h*a-c*r,d=l*r-n*a,m=e*u+i*f+s*d;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let p=1/m;return t[0]=u*p,t[1]=(s*l-c*i)*p,t[2]=(h*i-s*n)*p,t[3]=f*p,t[4]=(c*e-s*a)*p,t[5]=(s*r-h*e)*p,t[6]=d*p,t[7]=(i*a-l*e)*p,t[8]=(n*e-i*r)*p,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,s,r,n,h){let a=Math.cos(r),l=Math.sin(r);return this.set(i*a,i*l,-i*(a*n+l*h)+n+t,-s*l,s*a,-s*(-l*n+a*h)+h+e,0,0,1),this}scale(t,e){return this.premultiply(We.makeScale(t,e)),this}rotate(t){return this.premultiply(We.makeRotation(-t)),this}translate(t,e){return this.premultiply(We.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,i=t.elements;for(let s=0;s<9;s++)if(e[s]!==i[s])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new o().fromArray(this.elements)}},We=new nt,V;(function(o){o[o.Random=0]="Random",o[o.Loop=1]="Loop",o[o.PingPong=2]="PingPong",o[o.Burst=3]="Burst"})(V||(V={}));function Tt(o,t,e,i){let s;switch(V.Random===o?t=Math.random():V.Burst===o&&i.isBursting&&(t=i.burstParticleIndex/i.burstParticleCount),e>0?s=Math.floor(t/e)*e:s=t,o){case V.Loop:s=s%1;break;case V.PingPong:s=Math.abs(s%2-1);break}return s}var Vt=class o{constructor(t,e,i,s){this.p=[t,e,i,s]}genValue(t){let e=t*t,i=t*t*t,s=1-t,r=s*s,n=r*s;return this.p[0]*n+this.p[1]*r*t*3+this.p[2]*s*e*3+this.p[3]*i}derivativeCoefficients(t){let e=[];for(let i=t,s=i.length-1;s>0;s--){let r=[];for(let n=0;n<s;n++){let h=s*(i[n+1]-i[n]);r.push(h)}e.push(r),i=r}return e}getSlope(t){let e=this.derivativeCoefficients(this.p)[0],i=1-t,s=i*i,r=i*t*2,n=t*t;return s*e[0]+r*e[1]+n*e[2]}controlCurve(t,e){this.p[1]=t/3+this.p[0],this.p[2]=this.p[3]-e/3}hull(t){let e=this.p,i=[],s,r=0,n=0,h=0,a=[];for(a[r++]=e[0],a[r++]=e[1],a[r++]=e[2],a[r++]=e[3];e.length>1;){for(i=[],n=0,h=e.length-1;n<h;n++)s=t*e[n]+(1-t)*e[n+1],a[r++]=s,i.push(s);e=i}return a}split(t){let e=this.hull(t);return{left:new o(e[0],e[4],e[7],e[9]),right:new o(e[9],e[8],e[6],e[3]),span:e}}clone(){return new o(this.p[0],this.p[1],this.p[2],this.p[3])}toJSON(){return{p0:this.p[0],p1:this.p[1],p2:this.p[2],p3:this.p[3]}}static fromJSON(t){return new o(t.p0,t.p1,t.p2,t.p3)}},Jt=o=>({r:o.x,g:o.y,b:o.z,a:o.w}),Lt=o=>new D(o.r,o.g,o.b,o.a),ps=(o,t)=>{switch(t){case"Vector3":return new v(o.x,o.y,o.z);case"Vector4":return new D(o.x,o.y,o.z,o.w);case"Color":return new v(o.r,o.g,o.b);case"Number":return o;default:return o}},ys=(o,t)=>{switch(t){case"Vector3":return{x:o.x,y:o.y,z:o.z};case"Vector4":return{x:o.x,y:o.y,z:o.z,w:o.w};case"Color":return{r:o.x,g:o.y,b:o.z};case"Number":return o;default:return o}},je=class o{constructor(t,e){this.a=t,this.b=e,this.type="value"}startGen(t){}genColor(t,e){let i=Math.random();return e.copy(this.a).lerp(this.b,i)}toJSON(){return{type:"RandomColor",a:Jt(this.a),b:Jt(this.b)}}static fromJSON(t){return new o(Lt(t.a),Lt(t.b))}clone(){return new o(this.a.clone(),this.b.clone())}},Dt=class o{constructor(t,e){this.a=t,this.b=e,this.indexCount=-1,this.type="value"}startGen(t){this.indexCount=t.length,t.push(Math.random())}genColor(t,e){return this.indexCount===-1&&this.startGen(t),e.copy(this.a).lerp(this.b,t[this.indexCount])}toJSON(){return{type:"ColorRange",a:Jt(this.a),b:Jt(this.b)}}static fromJSON(t){return new o(Lt(t.a),Lt(t.b))}clone(){return new o(this.a.clone(),this.b.clone())}},gt=class o{constructor(t,e){this.subType=e,this.type="function",this.keys=t}findKey(t){let e=0,i=0,s=this.keys.length-1;for(;i+1<s;)if(e=Math.floor((i+s)/2),t<this.getStartX(e))s=e-1;else if(t>this.getEndX(e))i=e+1;else return e;for(let r=i;r<=s;r++)if(t>=this.getStartX(r)&&t<=this.getEndX(r))return r;return-1}getStartX(t){return this.keys[t][1]}getEndX(t){return t+1<this.keys.length?this.keys[t+1][1]:1}genValue(t,e){let i=this.findKey(e);return this.subType==="Number"?i===-1?this.keys[0][0]:i+1>=this.keys.length?this.keys[this.keys.length-1][0]:(this.keys[i+1][0]-this.keys[i][0])*((e-this.getStartX(i))/(this.getEndX(i)-this.getStartX(i)))+this.keys[i][0]:i===-1?t.copy(this.keys[0][0]):i+1>=this.keys.length?t.copy(this.keys[this.keys.length-1][0]):t.copy(this.keys[i][0]).lerp(this.keys[i+1][0],(e-this.getStartX(i))/(this.getEndX(i)-this.getStartX(i)))}toJSON(){return this.keys[0][0].constructor.name,{type:"CLinearFunction",subType:this.subType,keys:this.keys.map(([t,e])=>({value:ys(t,this.subType),pos:e}))}}static fromJSON(t){return new o(t.keys.map(e=>[ps(e.value,t.subType),e.pos]),t.subType)}clone(){return this.subType==="Number"?new o(this.keys.map(([t,e])=>[t,e]),this.subType):new o(this.keys.map(([t,e])=>[t.clone(),e]),this.subType)}},Kt=new v,Gt=class o{constructor(t=[[new v(0,0,0),0],[new v(1,1,1),0]],e=[[1,0],[1,1]]){this.type="function",this.color=new gt(t,"Color"),this.alpha=new gt(e,"Number")}genColor(t,e,i){return this.color.genValue(Kt,i),e.set(Kt.x,Kt.y,Kt.z,this.alpha.genValue(1,i))}toJSON(){return{type:"Gradient",color:this.color.toJSON(),alpha:this.alpha.toJSON()}}static fromJSON(t){if(t.functions){let e=t.functions.map(i=>[Dt.fromJSON(i.function).a,i.start]);return t.functions.length>0&&e.push([Dt.fromJSON(t.functions[t.functions.length-1].function).b,1]),new o(e.map(i=>[new v(i[0].x,i[0].y,i[0].z),i[1]]),e.map(i=>[i[0].w,i[1]]))}else{let e=new o;return e.alpha=gt.fromJSON(t.alpha),e.color=gt.fromJSON(t.color),e}}clone(){let t=new o;return t.alpha=this.alpha.clone(),t.color=this.color.clone(),t}startGen(t){}},Qe=new D,ti=class o{constructor(t,e){this.indexCount=0,this.type="function",this.gradient1=t,this.gradient2=e}startGen(t){this.indexCount=t.length,t.push(Math.random())}genColor(t,e,i){return this.gradient1.genColor(t,e,i),this.gradient2.genColor(t,Qe,i),t&&t[this.indexCount]!==void 0?e.lerp(Qe,t[this.indexCount]):e.lerp(Qe,Math.random()),e}toJSON(){return{type:"RandomColorBetweenGradient",gradient1:this.gradient1.toJSON(),gradient2:this.gradient2.toJSON()}}static fromJSON(t){return new o(Gt.fromJSON(t.gradient1),Gt.fromJSON(t.gradient2))}clone(){return new o(this.gradient1.clone(),this.gradient2.clone())}},vt=class o{constructor(t){this.color=t,this.type="value"}startGen(t){}genColor(t,e){return e.copy(this.color)}toJSON(){return{type:"ConstantColor",color:Jt(this.color)}}static fromJSON(t){return new o(Lt(t.color))}clone(){return new o(this.color.clone())}};function Ee(o){switch(o.type){case"ConstantColor":return vt.fromJSON(o);case"ColorRange":return Dt.fromJSON(o);case"RandomColor":return je.fromJSON(o);case"Gradient":return Gt.fromJSON(o);case"RandomColorBetweenGradient":return ti.fromJSON(o);default:return new vt(new D(1,1,1,1))}}var N=class o{constructor(t){this.value=t,this.type="value"}startGen(t){}genValue(t){return this.value}toJSON(){return{type:"ConstantValue",value:this.value}}static fromJSON(t){return new o(t.value)}clone(){return new o(this.value)}},St=class o{constructor(t,e){this.a=t,this.b=e,this.indexCount=-1,this.type="value"}startGen(t){this.indexCount=t.length,t.push(Math.random())}genValue(t){return this.indexCount===-1&&this.startGen(t),Ot.lerp(this.a,this.b,t[this.indexCount])}toJSON(){return{type:"IntervalValue",a:this.a,b:this.b}}static fromJSON(t){return new o(t.a,t.b)}clone(){return new o(this.a,this.b)}},ei=class{constructor(){this.functions=new Array}findFunction(t){let e=0,i=0,s=this.functions.length-1;for(;i+1<s;)if(e=Math.floor((i+s)/2),t<this.getStartX(e))s=e-1;else if(t>this.getEndX(e))i=e+1;else return e;for(let r=i;r<=s;r++)if(t>=this.functions[r][1]&&t<=this.getEndX(r))return r;return-1}getStartX(t){return this.functions[t][1]}setStartX(t,e){t>0&&(this.functions[t][1]=e)}getEndX(t){return t+1<this.functions.length?this.functions[t+1][1]:1}setEndX(t,e){t+1<this.functions.length&&(this.functions[t+1][1]=e)}insertFunction(t,e){let i=this.findFunction(t);this.functions.splice(i+1,0,[e,t])}removeFunction(t){return this.functions.splice(t,1)[0][0]}getFunction(t){return this.functions[t][0]}setFunction(t,e){this.functions[t][0]=e}get numOfFunctions(){return this.functions.length}},te=class o extends ei{constructor(t=[[new Vt(0,1/3,1/3*2,1),0]]){super(),this.type="function",this.functions=t}genValue(t,e=0){let i=this.findFunction(e);return i===-1?0:this.functions[i][0].genValue((e-this.getStartX(i))/(this.getEndX(i)-this.getStartX(i)))}toSVG(t,e){if(e<1)return"";let i=["M",0,this.functions[0][0].p[0]].join(" ");for(let s=1/e;s<=1;s+=1/e)i=[i,"L",s*t,this.genValue(void 0,s)].join(" ");return i}toJSON(){return{type:"PiecewiseBezier",functions:this.functions.map(([t,e])=>({function:t.toJSON(),start:e}))}}static fromJSON(t){return new o(t.functions.map(e=>[Vt.fromJSON(e.function),e.start]))}clone(){return new o(this.functions.map(([t,e])=>[t.clone(),e]))}startGen(t){}};function T(o){switch(o.type){case"ConstantValue":return N.fromJSON(o);case"IntervalValue":return St.fromJSON(o);case"PiecewiseBezier":return te.fromJSON(o);default:return new N(0)}}var ee=class o{constructor(){this.indexCount=0,this.type="rotation"}startGen(t){this.indexCount=t.length,t.push(new A);let e,i,s,r,n,h;do e=Math.random()*2-1,i=Math.random()*2-1,s=e*e+i*i;while(s>1);do r=Math.random()*2-1,n=Math.random()*2-1,h=r*r+n*n;while(h>1);let a=Math.sqrt((1-s)/h);t[this.indexCount].set(e,i,a*r,a*n)}genValue(t,e,i,s){return this.indexCount===-1&&this.startGen(t),e.copy(t[this.indexCount]),e}toJSON(){return{type:"RandomQuat"}}static fromJSON(t){return new o}clone(){return new o}},qt=class o{constructor(t,e){this.axis=t,this.angle=e,this.type="rotation"}startGen(t){this.angle.startGen(t)}genValue(t,e,i,s){return e.setFromAxisAngle(this.axis,this.angle.genValue(t,s)*i)}toJSON(){return{type:"AxisAngle",axis:{x:this.axis.x,y:this.axis.y,z:this.axis.z},angle:this.angle.toJSON()}}static fromJSON(t){return new o(new v(t.axis.x,t.axis.y,t.axis.z),T(t.angle))}clone(){return new o(this.axis.clone(),this.angle.clone())}},ii=class o{constructor(t,e,i,s){this.angleX=t,this.angleY=e,this.angleZ=i,this.type="rotation",this.eular=new jt(0,0,0,s)}startGen(t){this.angleX.startGen(t),this.angleY.startGen(t),this.angleZ.startGen(t)}genValue(t,e,i,s){return this.eular.set(this.angleX.genValue(t,s)*i,this.angleY.genValue(t,s)*i,this.angleZ.genValue(t,s)*i),e.setFromEuler(this.eular)}toJSON(){return{type:"Euler",angleX:this.angleX.toJSON(),angleY:this.angleY.toJSON(),angleZ:this.angleZ.toJSON(),eulerOrder:this.eular.order}}static fromJSON(t){return new o(T(t.angleX),T(t.angleY),T(t.angleZ),t.eulerOrder)}clone(){return new o(this.angleX,this.angleY,this.angleZ,this.eular.order)}};function Bi(o){switch(o.type){case"AxisAngle":return qt.fromJSON(o);case"Euler":return ii.fromJSON(o);case"RandomQuat":return ee.fromJSON(o);default:return new ee}}var Mt=class o{constructor(t,e,i){this.x=t,this.y=e,this.z=i,this.type="vec3function"}startGen(t){this.x.startGen(t),this.y.startGen(t),this.z.startGen(t)}genValue(t,e,i){return e.set(this.x.genValue(t,i),this.y.genValue(t,i),this.z.genValue(t,i))}toJSON(){return{type:"Vector3Function",x:this.x.toJSON(),y:this.y.toJSON(),z:this.z.toJSON()}}static fromJSON(t){return new o(T(t.x),T(t.y),T(t.z))}clone(){return new o(this.x,this.y,this.z)}};function gs(o){switch(o.type){case"Vector3Function":return Mt.fromJSON(o);default:return new Mt(new N(0),new N(0),new N(0))}}function Yt(o){switch(o.type){case"ConstantValue":case"IntervalValue":case"PiecewiseBezier":return T(o);case"AxisAngle":case"RandomQuat":case"Euler":return Bi(o);case"Vector3Function":return gs(o);default:return new N(0)}}var ie=class o{constructor(t={}){this.type="cone",this.currentValue=0,this.radius=t.radius??10,this.arc=t.arc??2*Math.PI,this.thickness=t.thickness??1,this.angle=t.angle??Math.PI/6,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[]}update(t,e){V.Random!=this.mode&&(this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e)}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=Ot.lerp(1-this.thickness,1,Math.random()),r=i*this.arc,n=Math.sqrt(s),h=Math.sin(r),a=Math.cos(r);t.position.x=n*a,t.position.y=n*h,t.position.z=0;let l=this.angle*n;t.velocity.set(0,0,Math.cos(l)).addScaledVector(t.position,Math.sin(l)).multiplyScalar(t.startSpeed),t.position.multiplyScalar(this.radius)}toJSON(){return{type:"cone",radius:this.radius,arc:this.arc,thickness:this.thickness,angle:this.angle,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({radius:t.radius,arc:t.arc,thickness:t.thickness,angle:t.angle,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({radius:this.radius,arc:this.arc,thickness:this.thickness,angle:this.angle,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}},se=class o{constructor(t={}){this.type="circle",this.currentValue=0,this.radius=t.radius??10,this.arc=t.arc??2*Math.PI,this.thickness=t.thickness??1,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[]}update(t,e){this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=Ot.lerp(1-this.thickness,1,Math.random()),r=i*this.arc;t.position.x=Math.cos(r),t.position.y=Math.sin(r),t.position.z=0,t.velocity.copy(t.position).multiplyScalar(t.startSpeed),t.position.multiplyScalar(this.radius*s)}toJSON(){return{type:"circle",radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({radius:t.radius,arc:t.arc,thickness:t.thickness,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}};function $t(o,t){return Math.floor(Math.random()*(t-o))+o}var Ht=new v(0,1,0),Zt=new v(0,0,0),xs=new v(1,1,1),Ti=new v(0,0,1),re=class o{constructor(t={}){this.type="donut",this.currentValue=0,this.radius=t.radius??10,this.arc=t.arc??2*Math.PI,this.thickness=t.thickness??1,this.donutRadius=t.donutRadius??this.radius*.2,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[],this._m1=new rt}update(t,e){V.Random!=this.mode&&(this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e)}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=Math.random(),r=Ot.lerp(1-this.thickness,1,Math.random()),n=i*this.arc,h=s*Math.PI*2,a=Math.sin(n),l=Math.cos(n);t.position.x=this.radius*l,t.position.y=this.radius*a,t.position.z=0,t.velocity.z=this.donutRadius*r*Math.sin(h),t.velocity.x=this.donutRadius*r*Math.cos(h)*l,t.velocity.y=this.donutRadius*r*Math.cos(h)*a,t.position.add(t.velocity),t.velocity.normalize().multiplyScalar(t.startSpeed),t.rotation instanceof A&&(this._m1.lookAt(Zt,t.velocity,Ht),t.rotation.setFromRotationMatrix(this._m1))}toJSON(){return{type:"donut",radius:this.radius,arc:this.arc,thickness:this.thickness,donutRadius:this.donutRadius,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({radius:t.radius,arc:t.arc,thickness:t.thickness,donutRadius:t.donutRadius,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({radius:this.radius,arc:this.arc,thickness:this.thickness,donutRadius:this.donutRadius,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}},ne=class o{constructor(){this.type="point",this._m1=new rt}update(t,e){}initialize(t){let e=Math.random(),i=Math.random(),s=e*Math.PI*2,r=Math.acos(2*i-1),n=Math.cbrt(Math.random()),h=Math.sin(s),a=Math.cos(s),l=Math.sin(r),c=Math.cos(r);t.velocity.x=n*l*a,t.velocity.y=n*l*h,t.velocity.z=n*c,t.velocity.multiplyScalar(t.startSpeed),t.position.setScalar(0),t.rotation instanceof A&&(this._m1.lookAt(Zt,t.position,Ht),t.rotation.setFromRotationMatrix(this._m1))}toJSON(){return{type:"point"}}static fromJSON(t){return new o}clone(){return new o}},_t=class o{constructor(t={}){this.type="sphere",this.currentValue=0,this.radius=t.radius??10,this.arc=t.arc??2*Math.PI,this.thickness=t.thickness??1,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[],this._m1=new rt}update(t,e){V.Random!=this.mode&&(this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e)}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=Math.random(),r=Ot.lerp(1-this.thickness,1,Math.random()),n=i*this.arc,h=Math.acos(2*s-1),a=Math.sin(n),l=Math.cos(n),c=Math.sin(h),u=Math.cos(h);t.position.x=c*l,t.position.y=c*a,t.position.z=u,t.velocity.copy(t.position).multiplyScalar(t.startSpeed),t.position.multiplyScalar(this.radius*r),t.rotation instanceof A&&(this._m1.lookAt(Zt,t.position,Ht),t.rotation.setFromRotationMatrix(this._m1))}toJSON(){return{type:"sphere",radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({radius:t.radius,arc:t.arc,thickness:t.thickness,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}},oe=class o{constructor(t={}){this.type="hemisphere",this.currentValue=0,this.radius=t.radius??10,this.arc=t.arc??2*Math.PI,this.thickness=t.thickness??1,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[],this._m1=new rt}update(t,e){V.Random!=this.mode&&(this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e)}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=Math.random(),r=Ot.lerp(1-this.thickness,1,Math.random()),n=i*this.arc,h=Math.acos(s),a=Math.sin(n),l=Math.cos(n),c=Math.sin(h),u=Math.cos(h);t.position.x=c*l,t.position.y=c*a,t.position.z=u,t.velocity.copy(t.position).multiplyScalar(t.startSpeed),t.position.multiplyScalar(this.radius*r),t.rotation instanceof A&&(this._m1.lookAt(Zt,t.position,Ht),t.rotation.setFromRotationMatrix(this._m1))}toJSON(){return{type:"hemisphere",radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({radius:t.radius,arc:t.arc,thickness:t.thickness,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({radius:this.radius,arc:this.arc,thickness:this.thickness,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}},ae=class o{constructor(t={}){this.type="grid",this.width=t.width??1,this.height=t.height??1,this.column=t.column??10,this.row=t.row??10}initialize(t){let e=Math.floor(Math.random()*this.row),i=Math.floor(Math.random()*this.column);t.position.x=i*this.width/this.column-this.width/2,t.position.y=e*this.height/this.row-this.height/2,t.position.z=0,t.velocity.set(0,0,t.startSpeed)}toJSON(){return{type:"grid",width:this.width,height:this.height,column:this.column,row:this.row}}static fromJSON(t){return new o(t)}clone(){return new o({width:this.width,height:this.height,column:this.column,row:this.row})}update(t,e){}},he=class o{constructor(t={}){this.type="rectangle",this.currentValue=0,this.width=t.width??10,this.height=t.height??10,this.thickness=t.thickness??1,this.mode=t.mode??V.Random,this.spread=t.spread??0,this.speed=t.speed??new N(1),this.memory=[],this._m1=new rt}update(t,e){this.currentValue+=this.speed.genValue(this.memory,t.emissionState.time/t.duration)*e}initialize(t,e){let i=Tt(this.mode,this.currentValue,this.spread,e),s=2*(this.width+this.height),r=i*s,n,h;r<this.width?(n=r-this.width/2,h=-this.height/2):r<this.width+this.height?(n=this.width/2,h=r-this.width-this.height/2):r<2*this.width+this.height?(n=this.width/2-(r-this.width-this.height),h=this.height/2):(n=-this.width/2,h=this.height/2-(r-2*this.width-this.height));let a=Math.random(),l=1-this.thickness*a;t.position.x=n*l,t.position.y=h*l,t.position.z=0,t.velocity.x=n,t.velocity.y=h,t.velocity.z=0,t.velocity.normalize().multiplyScalar(t.startSpeed),t.rotation instanceof A&&(this._m1.lookAt(Zt,t.velocity,Ht),t.rotation.setFromRotationMatrix(this._m1))}toJSON(){return{type:"rectangle",width:this.width,height:this.height,thickness:this.thickness,mode:this.mode,spread:this.spread,speed:this.speed.toJSON()}}static fromJSON(t){return new o({width:t.width,height:t.height,thickness:t.thickness,mode:t.mode,speed:t.speed?T(t.speed):void 0,spread:t.spread})}clone(){return new o({width:this.width,height:this.height,thickness:this.thickness,mode:this.mode,speed:this.speed.clone(),spread:this.spread})}},Xt={circle:{type:"circle",params:[["radius",["number"]],["arc",["radian"]],["thickness",["number"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:se,loadJSON:se.fromJSON},cone:{type:"cone",params:[["radius",["number"]],["arc",["radian"]],["thickness",["number"]],["angle",["radian"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:ie,loadJSON:ie.fromJSON},donut:{type:"donut",params:[["radius",["number"]],["arc",["radian"]],["thickness",["number"]],["donutRadius",["number"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:re,loadJSON:re.fromJSON},point:{type:"point",params:[],constructor:ne,loadJSON:ne.fromJSON},sphere:{type:"sphere",params:[["radius",["number"]],["arc",["radian"]],["thickness",["number"]],["angle",["radian"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:_t,loadJSON:_t.fromJSON},hemisphere:{type:"hemisphere",params:[["radius",["number"]],["arc",["radian"]],["thickness",["number"]],["angle",["radian"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:oe,loadJSON:oe.fromJSON},grid:{type:"grid",params:[["width",["number"]],["height",["number"]],["rows",["number"]],["column",["number"]]],constructor:ae,loadJSON:ae.fromJSON},rectangle:{type:"rectangle",params:[["width",["number"]],["height",["number"]],["thickness",["number"]],["mode",["emitterMode"]],["spread",["number"]],["speed",["valueFunc","value"]]],constructor:he,loadJSON:he.fromJSON}};function Ri(o,t){return Xt[o.type].loadJSON(o,t)}var le=class o{constructor(t){this.color=t,this.type="ColorOverLife"}initialize(t){this.color.startGen(t.memory)}update(t,e){this.color.genColor(t.memory,t.color,t.age/t.life),t.color.x*=t.startColor.x,t.color.y*=t.startColor.y,t.color.z*=t.startColor.z,t.color.w*=t.startColor.w}frameUpdate(t){}toJSON(){return{type:this.type,color:this.color.toJSON()}}static fromJSON(t){return new o(Ee(t.color))}clone(){return new o(this.color.clone())}reset(){}},ce=class o{constructor(t){this.angularVelocity=t,this.type="RotationOverLife"}initialize(t){typeof t.rotation=="number"&&this.angularVelocity.startGen(t.memory)}update(t,e){typeof t.rotation=="number"&&(t.rotation+=e*this.angularVelocity.genValue(t.memory,t.age/t.life))}toJSON(){return{type:this.type,angularVelocity:this.angularVelocity.toJSON()}}static fromJSON(t){return new o(T(t.angularVelocity))}frameUpdate(t){}clone(){return new o(this.angularVelocity.clone())}reset(){}},ue=class o{constructor(t){this.angularVelocity=t,this.type="Rotation3DOverLife",this.tempQuat=new A,this.tempQuat2=new A}initialize(t){t.rotation instanceof A&&(t.angularVelocity=new A,this.angularVelocity.startGen(t.memory))}update(t,e){t.rotation instanceof A&&(this.angularVelocity.genValue(t.memory,this.tempQuat,e,t.age/t.life),t.rotation.multiply(this.tempQuat))}toJSON(){return{type:this.type,angularVelocity:this.angularVelocity.toJSON()}}static fromJSON(t){return new o(Bi(t.angularVelocity))}frameUpdate(t){}clone(){return new o(this.angularVelocity.clone())}reset(){}},de=class o{initialize(t,e){this.ps=e,this.x.startGen(t.memory),this.y.startGen(t.memory),this.z.startGen(t.memory)}constructor(t,e,i){this.x=t,this.y=e,this.z=i,this.type="ForceOverLife",this._temp=new v,this._tempScale=new v,this._tempQ=new A}update(t,e){this._temp.set(this.x.genValue(t.memory,t.age/t.life),this.y.genValue(t.memory,t.age/t.life),this.z.genValue(t.memory,t.age/t.life)),this.ps.worldSpace?t.velocity.addScaledVector(this._temp,e):(this._temp.multiply(this._tempScale).applyQuaternion(this._tempQ),t.velocity.addScaledVector(this._temp,e))}toJSON(){return{type:this.type,x:this.x.toJSON(),y:this.y.toJSON(),z:this.z.toJSON()}}static fromJSON(t){return new o(T(t.x),T(t.y),T(t.z))}frameUpdate(t){if(this.ps&&!this.ps.worldSpace){let e=this._temp,i=this._tempQ,s=this._tempScale;this.ps.emitter.matrixWorld.decompose(e,i,s),i.invert(),s.set(1/s.x,1/s.y,1/s.z)}}clone(){return new o(this.x.clone(),this.y.clone(),this.z.clone())}reset(){}},me=class o{initialize(t){this.size.startGen(t.memory)}constructor(t){this.size=t,this.type="SizeOverLife"}update(t){this.size instanceof Mt?this.size.genValue(t.memory,t.size,t.age/t.life).multiply(t.startSize):t.size.copy(t.startSize).multiplyScalar(this.size.genValue(t.memory,t.age/t.life))}toJSON(){return{type:this.type,size:this.size.toJSON()}}static fromJSON(t){return new o(Yt(t.size))}frameUpdate(t){}clone(){return new o(this.size.clone())}reset(){}},fe=class o{initialize(t){this.speed.startGen(t.memory)}constructor(t){this.speed=t,this.type="SpeedOverLife"}update(t){t.speedModifier=this.speed.genValue(t.memory,t.age/t.life)}toJSON(){return{type:this.type,speed:this.speed.toJSON()}}static fromJSON(t){return new o(T(t.speed))}frameUpdate(t){}clone(){return new o(this.speed.clone())}reset(){}},pe=class o{constructor(t){this.frame=t,this.type="FrameOverLife"}initialize(t){this.frame.startGen(t.memory)}update(t,e){this.frame instanceof te&&(t.uvTile=this.frame.genValue(t.memory,t.age/t.life))}frameUpdate(t){}toJSON(){return{type:this.type,frame:this.frame.toJSON()}}static fromJSON(t){return new o(T(t.frame))}clone(){return new o(this.frame.clone())}reset(){}},ye=class o{constructor(t,e=new v(0,1,0)){this.orbitSpeed=t,this.axis=e,this.type="OrbitOverLife",this.temp=new v,this.rotation=new A}initialize(t){this.orbitSpeed.startGen(t.memory)}update(t,e){this.temp.copy(t.position).projectOnVector(this.axis),this.rotation.setFromAxisAngle(this.axis,this.orbitSpeed.genValue(t.memory,t.age/t.life)*e),t.position.sub(this.temp),t.position.applyQuaternion(this.rotation),t.position.add(this.temp)}frameUpdate(t){}toJSON(){return{type:this.type,orbitSpeed:this.orbitSpeed.toJSON(),axis:[this.axis.x,this.axis.y,this.axis.z]}}static fromJSON(t){return new o(T(t.orbitSpeed),t.axis?new v(t.axis[0],t.axis[1],t.axis[2]):void 0)}clone(){return new o(this.orbitSpeed.clone())}reset(){}},It=class{constructor(t){this.data=t,this.next=null,this.prev=null}hasPrev(){return this.prev!==null}hasNext(){return this.next!==null}},si=class{constructor(){this.length=0,this.head=this.tail=null}isEmpty(){return this.head===null}clear(){this.length=0,this.head=this.tail=null}front(){return this.head===null?null:this.head.data}back(){return this.tail===null?null:this.tail.data}dequeue(){if(this.head){let t=this.head.data;return this.head=this.head.next,this.head?this.head.prev=null:this.tail=null,this.length--,t}}pop(){if(this.tail){let t=this.tail.data;return this.tail=this.tail.prev,this.tail?this.tail.next=null:this.head=null,this.length--,t}}queue(t){let e=new It(t);this.tail||(this.tail=e),this.head&&(this.head.prev=e,e.next=this.head),this.head=e,this.length++}push(t){let e=new It(t);this.head||(this.head=e),this.tail&&(this.tail.next=e,e.prev=this.tail),this.tail=e,this.length++}insertBefore(t,e){let i=new It(e);i.next=t,i.prev=t.prev,i.prev!==null&&(i.prev.next=i),i.next.prev=i,t==this.head&&(this.head=i),this.length++}remove(t){if(this.head===null||this.tail===null)return;let e=this.head;for(t===this.head.data&&(this.head=this.head.next),t===this.tail.data&&(this.tail=this.tail.prev);e.next!==null&&e.data!==t;)e=e.next;e.data===t&&(e.prev!==null&&(e.prev.next=e.next),e.next!==null&&(e.next.prev=e.prev),this.length--)}*values(){let t=this.head;for(;t!==null;)yield t.data,t=t.next}},Ai=class{constructor(){this.position=new v,this.velocity=new v,this.age=0,this.life=1,this.size=new v,this.rotation=0,this.color=new D(1,1,1,1),this.uvTile=0,this.memory=[]}get died(){return this.age>=this.life}reset(){this.memory.length=0,this.position.set(0,0,0),this.velocity.set(0,0,0),this.age=0,this.life=1,this.size.set(1,1,1),this.rotation=0,this.color.set(1,1,1,1),this.uvTile=0}},ge=class{constructor(){this.startSpeed=0,this.startColor=new D,this.startSize=new v(1,1,1),this.position=new v,this.velocity=new v,this.age=0,this.life=1,this.size=new v(1,1,1),this.speedModifier=1,this.rotation=0,this.color=new D,this.uvTile=0,this.memory=[]}get died(){return this.age>=this.life}reset(){this.memory.length=0}},ri=class{constructor(t,e,i){this.position=t,this.size=e,this.color=i}},wt=class{constructor(){this.startSpeed=0,this.startColor=new D,this.startSize=new v(1,1,1),this.position=new v,this.velocity=new v,this.age=0,this.life=1,this.size=new v(1,1,1),this.length=100,this.speedModifier=1,this.color=new D,this.previous=new si,this.uvTile=0,this.memory=[]}update(){for(this.age<=this.life?this.previous.push(new ri(this.position.clone(),this.size.x,this.color.clone())):this.previous.length>0&&this.previous.dequeue();this.previous.length>this.length;)this.previous.dequeue()}get died(){return this.age>=this.life}reset(){this.memory.length=0,this.previous.clear()}},xe=class o{initialize(t){this.width.startGen(t.memory)}constructor(t){this.width=t,this.type="WidthOverLength"}update(t){if(t instanceof wt){let e=t.previous.values();for(let i=0;i<t.previous.length;i++){let s=e.next();s.value.size=this.width.genValue(t.memory,(t.previous.length-i)/t.length)}}}frameUpdate(t){}toJSON(){return{type:this.type,width:this.width.toJSON()}}static fromJSON(t){return new o(T(t.width))}clone(){return new o(this.width.clone())}reset(){}},ve=class o{constructor(t,e){this.direction=t,this.magnitude=e,this.type="ApplyForce",this.memory={data:[],dataCount:0},this.magnitudeValue=this.magnitude.genValue(this.memory)}initialize(t){}update(t,e){t.velocity.addScaledVector(this.direction,this.magnitudeValue*e)}frameUpdate(t){this.magnitudeValue=this.magnitude.genValue(this.memory)}toJSON(){return{type:this.type,direction:[this.direction.x,this.direction.y,this.direction.z],magnitude:this.magnitude.toJSON()}}static fromJSON(t){return new o(new v(t.direction[0],t.direction[1],t.direction[2]),T(t.magnitude??t.force))}clone(){return new o(this.direction.clone(),this.magnitude.clone())}reset(){}},Se=class o{constructor(t,e){this.center=t,this.magnitude=e,this.type="GravityForce",this.temp=new v}initialize(t){}update(t,e){this.temp.copy(this.center).sub(t.position).normalize(),t.velocity.addScaledVector(this.temp,this.magnitude/t.position.distanceToSquared(this.center)*e)}frameUpdate(t){}toJSON(){return{type:this.type,center:[this.center.x,this.center.y,this.center.z],magnitude:this.magnitude}}static fromJSON(t){return new o(new v(t.center[0],t.center[1],t.center[2]),t.magnitude)}clone(){return new o(this.center.clone(),this.magnitude)}reset(){}},Me=class o{constructor(t){this.angle=t,this.type="ChangeEmitDirection",this._temp=new v,this._q=new A,this.memory={data:[],dataCount:0}}initialize(t){let e=t.velocity.length();e!=0&&(t.velocity.normalize(),t.velocity.x===0&&t.velocity.y===0?this._temp.set(0,t.velocity.z,0):this._temp.set(-t.velocity.y,t.velocity.x,0),this.angle.startGen(this.memory),this._q.setFromAxisAngle(this._temp.normalize(),this.angle.genValue(this.memory)),this._temp.copy(t.velocity),t.velocity.applyQuaternion(this._q),this._q.setFromAxisAngle(this._temp,Math.random()*Math.PI*2),t.velocity.applyQuaternion(this._q),t.velocity.setLength(e))}update(t,e){}frameUpdate(t){}toJSON(){return{type:this.type,angle:this.angle.toJSON()}}static fromJSON(t){return new o(T(t.angle))}clone(){return new o(this.angle)}reset(){}},xt;(function(o){o[o.Death=0]="Death",o[o.Birth=1]="Birth",o[o.Frame=2]="Frame"})(xt||(xt={}));var zt=class o{constructor(t,e,i,s=xt.Frame,r=1){this.particleSystem=t,this.useVelocityAsBasis=e,this.subParticleSystem=i,this.mode=s,this.emitProbability=r,this.type="EmitSubParticleSystem",this.q_=new A,this.v_=new v,this.v2_=new v,this.subEmissions=new Array,this.subParticleSystem&&this.subParticleSystem.system&&(this.subParticleSystem.system.onlyUsedByOther=!0)}initialize(t){}update(t,e){this.mode===xt.Frame?this.emit(t,e):this.mode===xt.Birth&&t.age===0?this.emit(t,e):this.mode===xt.Death&&t.age+e>=t.life&&this.emit(t,e)}emit(t,e){if(!this.subParticleSystem||Math.random()>this.emitProbability)return;let i=new rt;this.setMatrixFromParticle(i,t),this.subEmissions.push({burstParticleCount:0,burstParticleIndex:0,isBursting:!1,burstIndex:0,burstWaveIndex:0,time:0,waitEmiting:0,matrix:i,travelDistance:0,particle:t})}frameUpdate(t){if(this.subParticleSystem)for(let e=0;e<this.subEmissions.length;e++)if(this.subEmissions[e].time>=this.subParticleSystem.system.duration)this.subEmissions[e]=this.subEmissions[this.subEmissions.length-1],this.subEmissions.length=this.subEmissions.length-1,e--;else{let i=this.subEmissions[e];i.particle&&i.particle.age<i.particle.life?this.setMatrixFromParticle(i.matrix,i.particle):i.particle=void 0,this.subParticleSystem.system.emit(t,i,i.matrix)}}toJSON(){return{type:this.type,subParticleSystem:this.subParticleSystem?this.subParticleSystem.uuid:"",useVelocityAsBasis:this.useVelocityAsBasis,mode:this.mode,emitProbability:this.emitProbability}}static fromJSON(t,e){return new o(e,t.useVelocityAsBasis,t.subParticleSystem,t.mode,t.emitProbability)}clone(){return new o(this.particleSystem,this.useVelocityAsBasis,this.subParticleSystem,this.mode,this.emitProbability)}reset(){}setMatrixFromParticle(t,e){let i;if(e.rotation===void 0||this.useVelocityAsBasis)if(e.velocity.x===0&&e.velocity.y===0&&(e.velocity.z===1||e.velocity.z===0))t.set(1,0,0,e.position.x,0,1,0,e.position.y,0,0,1,e.position.z,0,0,0,1);else{this.v_.copy(Ti).cross(e.velocity),this.v2_.copy(e.velocity).cross(this.v_);let s=this.v_.length(),r=this.v2_.length();t.set(this.v_.x/s,this.v2_.x/r,e.velocity.x,e.position.x,this.v_.y/s,this.v2_.y/r,e.velocity.y,e.position.y,this.v_.z/s,this.v2_.z/r,e.velocity.z,e.position.z,0,0,0,1)}else e.rotation instanceof A?i=e.rotation:(this.q_.setFromAxisAngle(Ti,e.rotation),i=this.q_),t.compose(e.position,i,xs);this.particleSystem.worldSpace||t.multiplyMatrices(this.particleSystem.emitter.matrixWorld,t)}},vs=.5*(Math.sqrt(3)-1),Ft=(3-Math.sqrt(3))/6,Ss=1/3,et=1/6,Ms=(Math.sqrt(5)-1)/4,F=(5-Math.sqrt(5))/20,k=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]),B=new Float32Array([0,1,1,1,0,1,1,-1,0,1,-1,1,0,1,-1,-1,0,-1,1,1,0,-1,1,-1,0,-1,-1,1,0,-1,-1,-1,1,0,1,1,1,0,1,-1,1,0,-1,1,1,0,-1,-1,-1,0,1,1,-1,0,1,-1,-1,0,-1,1,-1,0,-1,-1,1,1,0,1,1,1,0,-1,1,-1,0,1,1,-1,0,-1,-1,1,0,1,-1,1,0,-1,-1,-1,0,1,-1,-1,0,-1,1,1,1,0,1,1,-1,0,1,-1,1,0,1,-1,-1,0,-1,1,1,0,-1,1,-1,0,-1,-1,1,0,-1,-1,-1,0]),_e=class{constructor(t=Math.random){let e=typeof t=="function"?t:ws(t);this.p=_s(e),this.perm=new Uint8Array(512),this.permMod12=new Uint8Array(512);for(let i=0;i<512;i++)this.perm[i]=this.p[i&255],this.permMod12[i]=this.perm[i]%12}noise2D(t,e){let i=this.permMod12,s=this.perm,r=0,n=0,h=0,a=(t+e)*vs,l=Math.floor(t+a),c=Math.floor(e+a),u=(l+c)*Ft,f=l-u,d=c-u,m=t-f,p=e-d,y,x;m>p?(y=1,x=0):(y=0,x=1);let z=m-y+Ft,b=p-x+Ft,w=m-1+2*Ft,M=p-1+2*Ft,g=l&255,S=c&255,O=.5-m*m-p*p;if(O>=0){let C=i[g+s[S]]*3;O*=O,r=O*O*(k[C]*m+k[C+1]*p)}let E=.5-z*z-b*b;if(E>=0){let C=i[g+y+s[S+x]]*3;E*=E,n=E*E*(k[C]*z+k[C+1]*b)}let P=.5-w*w-M*M;if(P>=0){let C=i[g+1+s[S+1]]*3;P*=P,h=P*P*(k[C]*w+k[C+1]*M)}return 70*(r+n+h)}noise3D(t,e,i){let s=this.permMod12,r=this.perm,n,h,a,l,c=(t+e+i)*Ss,u=Math.floor(t+c),f=Math.floor(e+c),d=Math.floor(i+c),m=(u+f+d)*et,p=u-m,y=f-m,x=d-m,z=t-p,b=e-y,w=i-x,M,g,S,O,E,P;z>=b?b>=w?(M=1,g=0,S=0,O=1,E=1,P=0):z>=w?(M=1,g=0,S=0,O=1,E=0,P=1):(M=0,g=0,S=1,O=1,E=0,P=1):b<w?(M=0,g=0,S=1,O=0,E=1,P=1):z<w?(M=0,g=1,S=0,O=0,E=1,P=1):(M=0,g=1,S=0,O=1,E=1,P=0);let C=z-M+et,J=b-g+et,Y=w-S+et,H=z-O+2*et,Z=b-E+2*et,W=w-P+2*et,Q=z-1+3*et,K=b-1+3*et,$=w-1+3*et,q=u&255,X=f&255,pt=d&255,ct=.6-z*z-b*b-w*w;if(ct<0)n=0;else{let R=s[q+r[X+r[pt]]]*3;ct*=ct,n=ct*ct*(k[R]*z+k[R+1]*b+k[R+2]*w)}let ut=.6-C*C-J*J-Y*Y;if(ut<0)h=0;else{let R=s[q+M+r[X+g+r[pt+S]]]*3;ut*=ut,h=ut*ut*(k[R]*C+k[R+1]*J+k[R+2]*Y)}let ot=.6-H*H-Z*Z-W*W;if(ot<0)a=0;else{let R=s[q+O+r[X+E+r[pt+P]]]*3;ot*=ot,a=ot*ot*(k[R]*H+k[R+1]*Z+k[R+2]*W)}let at=.6-Q*Q-K*K-$*$;if(at<0)l=0;else{let R=s[q+1+r[X+1+r[pt+1]]]*3;at*=at,l=at*at*(k[R]*Q+k[R+1]*K+k[R+2]*$)}return 32*(n+h+a+l)}noise4D(t,e,i,s){let r=this.perm,n,h,a,l,c,u=(t+e+i+s)*Ms,f=Math.floor(t+u),d=Math.floor(e+u),m=Math.floor(i+u),p=Math.floor(s+u),y=(f+d+m+p)*F,x=f-y,z=d-y,b=m-y,w=p-y,M=t-x,g=e-z,S=i-b,O=s-w,E=0,P=0,C=0,J=0;M>g?E++:P++,M>S?E++:C++,M>O?E++:J++,g>S?P++:C++,g>O?P++:J++,S>O?C++:J++;let Y=E>=3?1:0,H=P>=3?1:0,Z=C>=3?1:0,W=J>=3?1:0,Q=E>=2?1:0,K=P>=2?1:0,$=C>=2?1:0,q=J>=2?1:0,X=E>=1?1:0,pt=P>=1?1:0,ct=C>=1?1:0,ut=J>=1?1:0,ot=M-Y+F,at=g-H+F,R=S-Z+F,Re=O-W+F,ke=M-Q+2*F,Fe=g-K+2*F,Ie=S-$+2*F,Ve=O-q+2*F,Je=M-X+3*F,Le=g-pt+3*F,De=S-ct+3*F,Ge=O-ut+3*F,qe=M-1+4*F,Xe=g-1+4*F,Ye=S-1+4*F,He=O-1+4*F,At=f&255,Nt=d&255,Et=m&255,Pt=p&255,Ct=.6-M*M-g*g-S*S-O*O;if(Ct<0)n=0;else{let U=r[At+r[Nt+r[Et+r[Pt]]]]%32*4;Ct*=Ct,n=Ct*Ct*(B[U]*M+B[U+1]*g+B[U+2]*S+B[U+3]*O)}let Ut=.6-ot*ot-at*at-R*R-Re*Re;if(Ut<0)h=0;else{let U=r[At+Y+r[Nt+H+r[Et+Z+r[Pt+W]]]]%32*4;Ut*=Ut,h=Ut*Ut*(B[U]*ot+B[U+1]*at+B[U+2]*R+B[U+3]*Re)}let Bt=.6-ke*ke-Fe*Fe-Ie*Ie-Ve*Ve;if(Bt<0)a=0;else{let U=r[At+Q+r[Nt+K+r[Et+$+r[Pt+q]]]]%32*4;Bt*=Bt,a=Bt*Bt*(B[U]*ke+B[U+1]*Fe+B[U+2]*Ie+B[U+3]*Ve)}let Rt=.6-Je*Je-Le*Le-De*De-Ge*Ge;if(Rt<0)l=0;else{let U=r[At+X+r[Nt+pt+r[Et+ct+r[Pt+ut]]]]%32*4;Rt*=Rt,l=Rt*Rt*(B[U]*Je+B[U+1]*Le+B[U+2]*De+B[U+3]*Ge)}let kt=.6-qe*qe-Xe*Xe-Ye*Ye-He*He;if(kt<0)c=0;else{let U=r[At+1+r[Nt+1+r[Et+1+r[Pt+1]]]]%32*4;kt*=kt,c=kt*kt*(B[U]*qe+B[U+1]*Xe+B[U+2]*Ye+B[U+3]*He)}return 27*(n+h+a+l+c)}};function _s(o){let t=new Uint8Array(256);for(let e=0;e<256;e++)t[e]=e;for(let e=0;e<255;e++){let i=e+~~(o()*(256-e)),s=t[e];t[e]=t[i],t[i]=s}return t}function ws(o){let t=0,e=0,i=0,s=1,r=zs();return t=r(" "),e=r(" "),i=r(" "),t-=r(o),t<0&&(t+=1),e-=r(o),e<0&&(e+=1),i-=r(o),i<0&&(i+=1),function(){let n=2091639*t+s*23283064365386963e-26;return t=e,e=i,i=n-(s=n|0)}}function zs(){let o=4022871197;return function(t){t=t.toString();for(let e=0;e<t.length;e++){o+=t.charCodeAt(e);let i=.02519603282416938*o;o=i>>>0,i-=o,i*=o,o=i>>>0,i-=o,o+=i*4294967296}return(o>>>0)*23283064365386963e-26}}var we=class o{constructor(t,e,i,s){this.scale=t,this.octaves=e,this.velocityMultiplier=i,this.timeScale=s,this.type="TurbulenceField",this.generator=new _e,this.timeOffset=new v,this.temp=new v,this.temp2=new v,this.timeOffset.x=Math.random()/this.scale.x*this.timeScale.x,this.timeOffset.y=Math.random()/this.scale.y*this.timeScale.y,this.timeOffset.z=Math.random()/this.scale.z*this.timeScale.z}initialize(t){}update(t,e){let i=t.position.x/this.scale.x,s=t.position.y/this.scale.y,r=t.position.z/this.scale.z;this.temp.set(0,0,0);let n=1;for(let h=0;h<this.octaves;h++)this.temp2.set(this.generator.noise4D(i*n,s*n,r*n,this.timeOffset.x*n)/n,this.generator.noise4D(i*n,s*n,r*n,this.timeOffset.y*n)/n,this.generator.noise4D(i*n,s*n,r*n,this.timeOffset.z*n)/n),this.temp.add(this.temp2),n*=2;this.temp.multiply(this.velocityMultiplier),t.velocity.addScaledVector(this.temp,e)}toJSON(){return{type:this.type,scale:[this.scale.x,this.scale.y,this.scale.z],octaves:this.octaves,velocityMultiplier:[this.velocityMultiplier.x,this.velocityMultiplier.y,this.velocityMultiplier.z],timeScale:[this.timeScale.x,this.timeScale.y,this.timeScale.z]}}frameUpdate(t){this.timeOffset.x+=t*this.timeScale.x,this.timeOffset.y+=t*this.timeScale.y,this.timeOffset.z+=t*this.timeScale.z}static fromJSON(t){return new o(new v(t.scale[0],t.scale[1],t.scale[2]),t.octaves,new v(t.velocityMultiplier[0],t.velocityMultiplier[1],t.velocityMultiplier[2]),new v(t.timeScale[0],t.timeScale[1],t.timeScale[2]))}clone(){return new o(this.scale.clone(),this.octaves,this.velocityMultiplier.clone(),this.timeScale.clone())}reset(){}},it=[],Ke=new v,$e=new A,ze=class o{constructor(t,e,i=new N(1),s=new N(0)){if(this.frequency=t,this.power=e,this.positionAmount=i,this.rotationAmount=s,this.type="Noise",this.duration=0,it.length===0)for(let r=0;r<100;r++)it.push(new _e)}initialize(t){t.lastPosNoise=new v,typeof t.rotation=="number"?t.lastRotNoise=0:t.lastRotNoise=new A,t.generatorIndex=[$t(0,100),$t(0,100),$t(0,100),$t(0,100)],this.positionAmount.startGen(t.memory),this.rotationAmount.startGen(t.memory),this.frequency.startGen(t.memory),this.power.startGen(t.memory)}update(t,e){let i=this.frequency.genValue(t.memory,t.age/t.life),s=this.power.genValue(t.memory,t.age/t.life),r=this.positionAmount.genValue(t.memory,t.age/t.life),n=this.rotationAmount.genValue(t.memory,t.age/t.life);r>0&&t.lastPosNoise!==void 0&&(t.position.sub(t.lastPosNoise),Ke.set(it[t.generatorIndex[0]].noise2D(0,t.age*i)*s*r,it[t.generatorIndex[1]].noise2D(0,t.age*i)*s*r,it[t.generatorIndex[2]].noise2D(0,t.age*i)*s*r),t.position.add(Ke),t.lastPosNoise.copy(Ke)),n>0&&t.lastRotNoise!==void 0&&(typeof t.rotation=="number"?(t.rotation-=t.lastRotNoise,t.rotation+=it[t.generatorIndex[3]].noise2D(0,t.age*i)*Math.PI*s*n):(t.lastRotNoise.invert(),t.rotation.multiply(t.lastRotNoise),$e.set(it[t.generatorIndex[0]].noise2D(0,t.age*i)*s*n,it[t.generatorIndex[1]].noise2D(0,t.age*i)*s*n,it[t.generatorIndex[2]].noise2D(0,t.age*i)*s*n,it[t.generatorIndex[3]].noise2D(0,t.age*i)*s*n).normalize(),t.rotation.multiply($e),t.lastRotNoise.copy($e)))}toJSON(){return{type:this.type,frequency:this.frequency.toJSON(),power:this.power.toJSON(),positionAmount:this.positionAmount.toJSON(),rotationAmount:this.rotationAmount.toJSON()}}frameUpdate(t){this.duration+=t}static fromJSON(t){return new o(T(t.frequency),T(t.power),T(t.positionAmount),T(t.rotationAmount))}clone(){return new o(this.frequency.clone(),this.power.clone(),this.positionAmount.clone(),this.rotationAmount.clone())}reset(){}},be=class o{constructor(t=0,e=0,i=new v){this.scaleX=t,this.scaleY=e,this.position=i,this.locations=[]}transform(t,e){t.x=this.locations[e%this.locations.length].x*this.scaleX+this.position.x,t.y=this.locations[e%this.locations.length].y*this.scaleY+this.position.y,t.z=this.position.z}static fromJSON(t){let e=new o(t.scaleX,t.scaleY,new v(t.position[0],t.position[1],t.position[2]));return e.locations=t.locations.map(i=>new ht(i.x,i.y)),e}clone(){let t=new o(this.scaleX,this.scaleY,this.position.clone());return t.locations=this.locations.map(e=>e.clone()),t}toJSON(){return{scaleX:this.scaleX,scaleY:this.scaleY,position:this.position,locations:this.locations.map(t=>({x:t.x,y:t.y}))}}fromImage(t,e){let i=document.createElement("canvas");i.width=t.width,i.height=t.height;let s=i.getContext("2d");if(!s)return;s.drawImage(t,0,0);let r=s.getImageData(0,0,i.width,i.height,{colorSpace:"srgb"});i.remove(),this.locations.length=0;for(let n=0;n<r.height;n++)for(let h=0;h<r.width;h++)r.data[(n*r.width+h)*4+3]>e&&this.locations.push(new ht(h,r.height-n))}};function bs(o){switch(o.type){case"TextureSequencer":return be.fromJSON(o);default:return new be}}var ni=class o{constructor(t){this.type="ApplySequences",this.sequencers=[],this.time=0,this.index=0,this.pCount=0,this.tempV=new v,this.delay=t}initialize(t){t.id=this.pCount,t.dst=new v,t.begin=new v,t.inMotion=!1,this.pCount++}reset(){this.time=0,this.index=0,this.pCount=0}update(t,e){let i=this.sequencers[this.index],s=t.id*this.delay;this.time>=i[0].a+s&&this.time<=i[0].b+s?(t.inMotion||(t.inMotion=!0,t.begin.copy(t.position),i[1].transform(t.dst,t.id)),t.position.lerpVectors(t.begin,t.dst,o.BEZIER.genValue((this.time-i[0].a-s)/(i[0].b-i[0].a)))):this.time>i[0].b+s&&(t.inMotion=!1)}frameUpdate(t){for(;this.index+1<this.sequencers.length&&this.time>=this.sequencers[this.index+1][0].a;)this.index++;this.time+=t}appendSequencer(t,e){this.sequencers.push([t,e])}toJSON(){return{type:this.type,delay:this.delay,sequencers:this.sequencers.map(([t,e])=>({range:t.toJSON(),sequencer:e.toJSON()}))}}static fromJSON(t){let e=new o(t.delay);return t.sequencers.forEach(i=>{e.sequencers.push([T(i.range),bs(i.sequencer)])}),e}clone(){let t=new o(this.delay);return t.sequencers=this.sequencers.map(e=>[e[0].clone(),e[1].clone()]),t}};ni.BEZIER=new Vt(0,0,1,1);var ki;function Tr(o){ki=o}function Os(){return ki}var Ni=class o{constructor(t,e){this.resolver=t,this.bounce=e,this.type="ApplyCollision",this.tempV=new v}initialize(t){}update(t,e){this.resolver.resolve(t.position,this.tempV)&&t.velocity.reflect(this.tempV).multiplyScalar(this.bounce)}frameUpdate(t){}toJSON(){return{type:this.type,bounce:this.bounce}}static fromJSON(t){return new o(Os(),t.bounce)}clone(){return new o(this.resolver,this.bounce)}reset(){}},Oe=class o{constructor(t,e){this.color=t,this.speedRange=e,this.type="ColorBySpeed"}initialize(t){this.color.startGen(t.memory)}update(t,e){let i=(t.startSpeed-this.speedRange.a)/(this.speedRange.b-this.speedRange.a);this.color.genColor(t.memory,t.color,i),t.color.x*=t.startColor.x,t.color.y*=t.startColor.y,t.color.z*=t.startColor.z,t.color.w*=t.startColor.w}frameUpdate(t){}toJSON(){return{type:this.type,color:this.color.toJSON(),speedRange:this.speedRange.toJSON()}}static fromJSON(t){return new o(Ee(t.color),St.fromJSON(t.speedRange))}clone(){return new o(this.color.clone(),this.speedRange.clone())}reset(){}},Te=class o{initialize(t){this.size.startGen(t.memory)}constructor(t,e){this.size=t,this.speedRange=e,this.type="SizeBySpeed"}update(t){let e=(t.startSpeed-this.speedRange.a)/(this.speedRange.b-this.speedRange.a);this.size instanceof Mt?this.size.genValue(t.memory,t.size,e).multiply(t.startSize):t.size.copy(t.startSize).multiplyScalar(this.size.genValue(t.memory,e))}toJSON(){return{type:this.type,size:this.size.toJSON(),speedRange:this.speedRange.toJSON()}}static fromJSON(t){return new o(Yt(t.size),St.fromJSON(t.speedRange))}frameUpdate(t){}clone(){return new o(this.size.clone(),this.speedRange.clone())}reset(){}},Ae=class o{constructor(t,e){this.angularVelocity=t,this.speedRange=e,this.type="RotationBySpeed",this.tempQuat=new A}initialize(t){typeof t.rotation=="number"&&this.angularVelocity.startGen(t.memory)}update(t,e){if(typeof t.rotation=="number"){let i=(t.startSpeed-this.speedRange.a)/(this.speedRange.b-this.speedRange.a);t.rotation+=e*this.angularVelocity.genValue(t.memory,i)}}toJSON(){return{type:this.type,angularVelocity:this.angularVelocity.toJSON(),speedRange:this.speedRange.toJSON()}}static fromJSON(t){return new o(T(t.angularVelocity),St.fromJSON(t.speedRange))}frameUpdate(t){}clone(){return new o(this.angularVelocity.clone(),this.speedRange.clone())}reset(){}},Ne=class o{initialize(t){this.speed.startGen(t.memory)}constructor(t,e){this.speed=t,this.dampen=e,this.type="LimitSpeedOverLife"}update(t,e){let i=t.velocity.length(),s=this.speed.genValue(t.memory,t.age/t.life);if(i>s){let r=(i-s)/i;t.velocity.multiplyScalar(1-r*this.dampen*e*20)}}toJSON(){return{type:this.type,speed:this.speed.toJSON(),dampen:this.dampen}}static fromJSON(t){return new o(T(t.speed),t.dampen)}frameUpdate(t){}clone(){return new o(this.speed.clone(),this.dampen)}reset(){}},bt={ApplyForce:{type:"ApplyForce",constructor:ve,params:[["direction",["vec3"]],["magnitude",["value"]]],loadJSON:ve.fromJSON},Noise:{type:"Noise",constructor:ze,params:[["frequency",["value"]],["power",["value"]],["positionAmount",["value"]],["rotationAmount",["value"]]],loadJSON:ze.fromJSON},TurbulenceField:{type:"TurbulenceField",constructor:we,params:[["scale",["vec3"]],["octaves",["number"]],["velocityMultiplier",["vec3"]],["timeScale",["vec3"]]],loadJSON:we.fromJSON},GravityForce:{type:"GravityForce",constructor:Se,params:[["center",["vec3"]],["magnitude",["number"]]],loadJSON:Se.fromJSON},ColorOverLife:{type:"ColorOverLife",constructor:le,params:[["color",["colorFunc"]]],loadJSON:le.fromJSON},RotationOverLife:{type:"RotationOverLife",constructor:ce,params:[["angularVelocity",["value","valueFunc"]]],loadJSON:ce.fromJSON},Rotation3DOverLife:{type:"Rotation3DOverLife",constructor:ue,params:[["angularVelocity",["rotationFunc"]]],loadJSON:ue.fromJSON},SizeOverLife:{type:"SizeOverLife",constructor:me,params:[["size",["value","valueFunc","vec3Func"]]],loadJSON:me.fromJSON},ColorBySpeed:{type:"ColorBySpeed",constructor:Oe,params:[["color",["colorFunc"]],["speedRange",["range"]]],loadJSON:Oe.fromJSON},RotationBySpeed:{type:"RotationBySpeed",constructor:Ae,params:[["angularVelocity",["value","valueFunc"]],["speedRange",["range"]]],loadJSON:Ae.fromJSON},SizeBySpeed:{type:"SizeBySpeed",constructor:Te,params:[["size",["value","valueFunc","vec3Func"]],["speedRange",["range"]]],loadJSON:Te.fromJSON},SpeedOverLife:{type:"SpeedOverLife",constructor:fe,params:[["speed",["value","valueFunc"]]],loadJSON:fe.fromJSON},FrameOverLife:{type:"FrameOverLife",constructor:pe,params:[["frame",["value","valueFunc"]]],loadJSON:pe.fromJSON},ForceOverLife:{type:"ForceOverLife",constructor:de,params:[["x",["value","valueFunc"]],["y",["value","valueFunc"]],["z",["value","valueFunc"]]],loadJSON:de.fromJSON},OrbitOverLife:{type:"OrbitOverLife",constructor:ye,params:[["orbitSpeed",["value","valueFunc"]],["axis",["vec3"]]],loadJSON:ye.fromJSON},WidthOverLength:{type:"WidthOverLength",constructor:xe,params:[["width",["value","valueFunc"]]],loadJSON:xe.fromJSON},ChangeEmitDirection:{type:"ChangeEmitDirection",constructor:Me,params:[["angle",["value"]]],loadJSON:Me.fromJSON},EmitSubParticleSystem:{type:"EmitSubParticleSystem",constructor:zt,params:[["particleSystem",["self"]],["useVelocityAsBasis",["boolean"]],["subParticleSystem",["particleSystem"]],["mode",["number"]],["emitProbability",["number"]]],loadJSON:zt.fromJSON},LimitSpeedOverLife:{type:"LimitSpeedOverLife",constructor:Ne,params:[["speed",["value","valueFunc"]],["dampen",["number"]]],loadJSON:Ne.fromJSON}};function Fi(o,t){return bt[o.type]?bt[o.type].loadJSON(o,t):null}var Ii=[];function Vi(o){if(!Ii.find(e=>e.id===o.id)){o.initialize();for(let e of o.emitterShapes)Xt[e.type]||(Xt[e.type]=e);for(let e of o.behaviors)bt[e.type]||(bt[e.type]=e)}}function Ar(o){let t=Ii.find(e=>e.id===o);if(t){for(let e of t.emitterShapes)Xt[e.type]&&delete Xt[e.type];for(let e of t.behaviors)bt[e.type]&&delete bt[e.type]}}var Ue=class o{get geometry(){return this._geometry}set geometry(t){if(this._geometry=t,t===void 0||typeof t=="string")return;let e=new Ts;this._triangleIndexToArea.length=0;let i=0;if(!t.getIndex())return;let s=t.getIndex().array,r=s.length/3;this._triangleIndexToArea.push(0);for(let n=0;n<r;n++)e.setFromAttributeAndIndices(t.getAttribute("position"),s[n*3],s[n*3+1],s[n*3+2]),i+=e.getArea(),this._triangleIndexToArea.push(i);t.userData.triangleIndexToArea=this._triangleIndexToArea}constructor(t){this.type="mesh_surface",this._triangleIndexToArea=[],this._tempA=new oi,this._tempB=new oi,this._tempC=new oi,t&&(this.geometry=t)}initialize(t){let e=this._geometry;if(!e||e.getIndex()===null){t.position.set(0,0,0),t.velocity.set(0,0,1).multiplyScalar(t.startSpeed);return}let i=this._triangleIndexToArea.length-1,s=0,r=i,n=Math.random()*this._triangleIndexToArea[i];for(;s+1<r;){let d=Math.floor((s+r)/2);n<this._triangleIndexToArea[d]?r=d:s=d}let h=Math.random(),a=Math.random();h+a>1&&(h=1-h,a=1-a);let l=e.getIndex().array[s*3],c=e.getIndex().array[s*3+1],u=e.getIndex().array[s*3+2],f=e.getAttribute("position");this._tempA.fromBufferAttribute(f,l),this._tempB.fromBufferAttribute(f,c),this._tempC.fromBufferAttribute(f,u),this._tempB.sub(this._tempA),this._tempC.sub(this._tempA),this._tempA.addScaledVector(this._tempB,h).addScaledVector(this._tempC,a),t.position.copy(this._tempA),this._tempA.copy(this._tempB).cross(this._tempC).normalize(),t.velocity.copy(this._tempA).normalize().multiplyScalar(t.startSpeed)}toJSON(){return{type:"mesh_surface",mesh:this._geometry?this._geometry.uuid:""}}static fromJSON(t,e){return new o(e.geometries[t.geometry])}clone(){return new o(this._geometry)}update(t,e){}},lr={id:"three.quarks",initialize:()=>{},emitterShapes:[{type:"mesh_surface",params:[["geometry",["geometry"]]],constructor:Ue,loadJSON:Ue.fromJSON}],behaviors:[]},cr=`
#ifdef SOFT_PARTICLES

    /* #ifdef LOGDEPTH
    float distSample = linearize_depth_log(sampleDepth, near, far);
    #else
    float distSample = ortho ? linearize_depth_ortho(sampleDepth, near, far) : linearize_depth(sampleDepth, near, far);
    #endif */

    vec2 p2 = projPosition.xy / projPosition.w;

    p2 = 0.5 * p2 + 0.5;

    float readDepth = texture2D(depthTexture, p2.xy).r;
    float viewDepth = linearize_depth(readDepth);

    float softParticlesFade = saturate(SOFT_INV_FADE_DISTANCE * ((viewDepth - SOFT_NEAR_FADE) - linearDepth));

    gl_FragColor *= softParticlesFade;

    //gl_FragColor = vec4(softParticlesFade , 0, 0, 1);
#endif
`,ur=`
#ifdef SOFT_PARTICLES

    uniform sampler2D depthTexture;
    uniform vec4 projParams;
    uniform vec2 softParams;

    varying vec4 projPosition;
    varying float linearDepth;

    #define SOFT_NEAR_FADE softParams.x
    #define SOFT_INV_FADE_DISTANCE softParams.y

    #define zNear projParams.x
    #define zFar projParams.y

    float linearize_depth(float d)
    {
        return (zFar * zNear) / (zFar - d * (zFar - zNear));
    }

#endif
`,dr=`
#ifdef SOFT_PARTICLES
    varying vec4 projPosition;
    varying float linearDepth;
#endif
`,mr=`
#ifdef SOFT_PARTICLES
    projPosition = gl_Position;
    linearDepth = -mvPosition.z;
#endif
`,fr=`
#ifdef USE_MAP
    vec4 texelColor = texture2D( map, vUv);
    #ifdef TILE_BLEND
        texelColor = mix( texelColor, texture2D( map, vUvNext ), vUvBlend );
    #endif
    diffuseColor *= texelColor;
#endif
`,pr=`
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;
#ifdef TILE_BLEND
    varying vec2 vUvNext;
    varying float vUvBlend;
#endif

#endif
#ifdef USE_MAP

	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#ifdef TILE_BLEND
    varying vec2 vMapUvNext;
#endif

#endif
#ifdef USE_ALPHAMAP

	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;

#endif
#ifdef USE_DISPLACEMENTMAP

	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SPECULARMAP

	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`,yr=`
#ifdef UV_TILE
    attribute float uvTile;
    uniform vec2 tileCount;

    mat3 makeTileTransform(float uvTile) {
        float col = mod(uvTile, tileCount.x);
        float row = (tileCount.y - floor(uvTile / tileCount.x) - 1.0);

        return mat3(
          1.0 / tileCount.x, 0.0, 0.0,
          0.0, 1.0 / tileCount.y, 0.0,
          col / tileCount.x, row / tileCount.y, 1.0);
    }
#else
    mat3 makeTileTransform(float uvTile) {
        return mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
    }
#endif

#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;
#ifdef TILE_BLEND
    varying vec2 vUvNext;
    varying float vUvBlend;
#endif

#endif
#ifdef USE_MAP

	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#ifdef TILE_BLEND
    varying vec2 vMapUvNext;
#endif

#endif
#ifdef USE_ALPHAMAP

	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;

#endif
#ifdef USE_DISPLACEMENTMAP

	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SPECULARMAP

	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`,gr=`
#ifdef UV_TILE
    mat3 tileTransform = makeTileTransform(floor(uvTile));
    #ifdef TILE_BLEND
        mat3 nextTileTransform = makeTileTransform(ceil(uvTile));
        vUvBlend = fract(uvTile);
    #endif
#else
    mat3 tileTransform = makeTileTransform(0.0);
#endif

#if defined( USE_UV ) || defined( USE_ANISOTROPY )

vUv = (tileTransform *vec3( uv, 1 )).xy;
#if defined( TILE_BLEND ) && defined( UV_TILE )
    vUvNext = (nextTileTransform *vec3( uv, 1 )).xy;
#endif

#endif
#ifdef USE_MAP

vMapUv = ( tileTransform * (mapTransform * vec3( MAP_UV, 1 ) )).xy;
#if defined( TILE_BLEND ) && defined( UV_TILE )
    vMapUvNext = (nextTileTransform * (mapTransform * vec3( MAP_UV, 1 ))).xy;
#endif

#endif
#ifdef USE_ALPHAMAP

vAlphaMapUv = ( tileTransform * (alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_LIGHTMAP

vLightMapUv = ( tileTransform * (lightMapTransform * vec3( LIGHTMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_AOMAP

vAoMapUv = ( tileTransform * (aoMapTransform * vec3( AOMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_BUMPMAP

vBumpMapUv = ( tileTransform * (bumpMapTransform * vec3( BUMPMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_NORMALMAP

vNormalMapUv = ( tileTransform * (normalMapTransform * vec3( NORMALMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_DISPLACEMENTMAP

vDisplacementMapUv = ( tileTransform * (displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_EMISSIVEMAP

vEmissiveMapUv = ( tileTransform * (emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_METALNESSMAP

vMetalnessMapUv = ( tileTransform * (metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_ROUGHNESSMAP

vRoughnessMapUv = ( tileTransform * (roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_ANISOTROPYMAP

vAnisotropyMapUv = ( tileTransform * (anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_CLEARCOATMAP

vClearcoatMapUv = ( tileTransform * (clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

vClearcoatNormalMapUv = ( tileTransform * (clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

vClearcoatRoughnessMapUv = ( tileTransform * (clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_IRIDESCENCEMAP

vIridescenceMapUv = ( tileTransform * (iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

vIridescenceThicknessMapUv = ( tileTransform * (iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_SHEEN_COLORMAP

vSheenColorMapUv = ( tileTransform * (sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

vSheenRoughnessMapUv = ( tileTransform * (sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_SPECULARMAP

vSpecularMapUv = ( tileTransform * (specularMapTransform * vec3( SPECULARMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_SPECULAR_COLORMAP

vSpecularColorMapUv = ( tileTransform * (specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

vSpecularIntensityMapUv = ( tileTransform * (specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_TRANSMISSIONMAP

vTransmissionMapUv = ( tileTransform * transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) )).xy;

#endif
#ifdef USE_THICKNESSMAP

vThicknessMapUv = ( tileTransform * thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) )).xy;

#endif

`,ft=As;function xr(){ft.tile_pars_vertex=yr,ft.tile_vertex=gr,ft.tile_pars_fragment=pr,ft.tile_fragment=fr,ft.soft_pars_vertex=dr,ft.soft_vertex=mr,ft.soft_pars_fragment=ur,ft.soft_fragment=cr}var ci=class extends vi{constructor(t){super(),this.type="ParticleEmitter",this.system=t}clone(){let t=this.system.clone();return t.emitter.copy(this,!0),t.emitter}dispose(){}extractFromCache(t){let e=[];for(let i in t){let s=t[i];delete s.metadata,e.push(s)}return e}toJSON(t,e={}){let i=this.children;this.children=this.children.filter(r=>r.type!=="ParticleSystemPreview");let s=super.toJSON(t);return this.children=i,this.system!==null&&(s.object.ps=this.system.toJSON(t,e)),s}},_;(function(o){o[o.BillBoard=0]="BillBoard",o[o.StretchedBillBoard=1]="StretchedBillBoard",o[o.Mesh=2]="Mesh",o[o.Trail=3]="Trail",o[o.HorizontalBillBoard=4]="HorizontalBillBoard",o[o.VerticalBillBoard=5]="VerticalBillBoard"})(_||(_={}));var Be=class extends Xi{constructor(t){super(),this.type="VFXBatch",this.maxParticles=1e3,this.systems=new Set;let e=new Ce;e.mask=t.layers.mask;let i=t.material.clone();i.defines={},Object.assign(i.defines,t.material.defines),this.settings={instancingGeometry:t.instancingGeometry,renderMode:t.renderMode,renderOrder:t.renderOrder,material:i,uTileCount:t.uTileCount,vTileCount:t.vTileCount,blendTiles:t.blendTiles,softParticles:t.softParticles,softNearFade:t.softNearFade,softFarFade:t.softFarFade,layers:e},this.frustumCulled=!1,this.renderOrder=this.settings.renderOrder}addSystem(t){this.systems.add(t)}removeSystem(t){this.systems.delete(t)}applyDepthTexture(t){let e=this.material.uniforms.depthTexture;e&&e.value!==t&&(e.value=t,this.material.needsUpdate=!0)}getVisibleSystems(){return Array.from(this.systems).filter(t=>t.emitter.visible)}},vr=new v(0,0,1),ai=new A,Sr=new v,Mr=new v;new v;var Di=60,Pe=new Ns(1,1,1,1),ui=class o{set time(t){this.emissionState.time=t}get time(){return this.emissionState.time}get layers(){return this.rendererSettings.layers}get texture(){return this.rendererSettings.material.map}set texture(t){this.rendererSettings.material.map=t,this.neededToUpdateRender=!0}get material(){return this.rendererSettings.material}set material(t){this.rendererSettings.material=t,this.neededToUpdateRender=!0}get uTileCount(){return this.rendererSettings.uTileCount}set uTileCount(t){this.rendererSettings.uTileCount=t,this.neededToUpdateRender=!0}get vTileCount(){return this.rendererSettings.vTileCount}set vTileCount(t){this.rendererSettings.vTileCount=t,this.neededToUpdateRender=!0}get blendTiles(){return this.rendererSettings.blendTiles}set blendTiles(t){this.rendererSettings.blendTiles=t,this.neededToUpdateRender=!0}get softParticles(){return this.rendererSettings.softParticles}set softParticles(t){this.rendererSettings.softParticles=t,this.neededToUpdateRender=!0}get softNearFade(){return this.rendererSettings.softNearFade}set softNearFade(t){this.rendererSettings.softNearFade=t,this.neededToUpdateRender=!0}get softFarFade(){return this.rendererSettings.softFarFade}set softFarFade(t){this.rendererSettings.softFarFade=t,this.neededToUpdateRender=!0}get instancingGeometry(){return this.rendererSettings.instancingGeometry}set instancingGeometry(t){this.restart(),this.particles.length=0,this.rendererSettings.instancingGeometry=t,this.neededToUpdateRender=!0}get renderMode(){return this.rendererSettings.renderMode}set renderMode(t){if(this.rendererSettings.renderMode!==t){let e=!1;switch(this.rendererSettings.renderMode===_.Trail&&(e=!0),this.rendererSettings.renderMode===_.Mesh&&(this.startRotation=new N(0)),t){case _.Trail:this.rendererEmitterSettings={startLength:new N(30),followLocalOrigin:!1},e=!0;break;case _.Mesh:this.rendererEmitterSettings={geometry:Pe},this.startRotation=new qt(new v(0,1,0),new N(0));break;case _.StretchedBillBoard:this.rendererEmitterSettings={speedFactor:0,lengthFactor:2},this.rendererSettings.instancingGeometry=Pe;break;case _.BillBoard:case _.VerticalBillBoard:case _.HorizontalBillBoard:this.rendererEmitterSettings={},this.rendererSettings.instancingGeometry=Pe;break}this.rendererSettings.renderMode=t,e&&(this.restart(),this.particles.length=0),this.neededToUpdateRender=!0}}get renderOrder(){return this.rendererSettings.renderOrder}set renderOrder(t){this.rendererSettings.renderOrder=t,this.neededToUpdateRender=!0}get blending(){return this.rendererSettings.material.blending}set blending(t){this.rendererSettings.material.blending=t,this.neededToUpdateRender=!0}constructor(t){if(this.temp=new v,this.travelDistance=0,this.normalMatrix=new nt,this.memory=[],this.listeners={},this.firstTimeUpdate=!0,this.autoDestroy=t.autoDestroy===void 0?!1:t.autoDestroy,this.duration=t.duration??1,this.looping=t.looping===void 0?!0:t.looping,this.prewarm=t.prewarm===void 0?!1:t.prewarm,this.startLife=t.startLife??new N(5),this.startSpeed=t.startSpeed??new N(0),this.startRotation=t.startRotation??new N(0),this.startSize=t.startSize??new N(1),this.startColor=t.startColor??new vt(new D(1,1,1,1)),this.emissionOverTime=t.emissionOverTime??new N(10),this.emissionOverDistance=t.emissionOverDistance??new N(0),this.emissionBursts=t.emissionBursts??[],this.onlyUsedByOther=t.onlyUsedByOther??!1,this.emitterShape=t.shape??new _t,this.behaviors=t.behaviors??new Array,this.worldSpace=t.worldSpace??!1,this.rendererEmitterSettings=t.rendererEmitterSettings??{},t.renderMode===_.StretchedBillBoard){let e=this.rendererEmitterSettings;t.speedFactor!==void 0&&(e.speedFactor=t.speedFactor),e.speedFactor=e.speedFactor??0,e.lengthFactor=e.lengthFactor??0}this.rendererSettings={instancingGeometry:t.instancingGeometry??Pe,renderMode:t.renderMode??_.BillBoard,renderOrder:t.renderOrder??0,material:t.material,uTileCount:t.uTileCount??1,vTileCount:t.vTileCount??1,blendTiles:t.blendTiles??!1,softParticles:t.softParticles??!1,softNearFade:t.softNearFade??0,softFarFade:t.softFarFade??0,layers:t.layers??new Ce},this.neededToUpdateRender=!0,this.particles=new Array,this.startTileIndex=t.startTileIndex||new N(0),this.emitter=new ci(this),this.paused=!1,this.particleNum=0,this.emissionState={isBursting:!1,burstParticleIndex:0,burstParticleCount:0,burstIndex:0,burstWaveIndex:0,time:0,waitEmiting:0,travelDistance:0},this.emissionBursts.forEach(e=>e.count.startGen(this.memory)),this.emissionOverDistance.startGen(this.memory),this.emitEnded=!1,this.markForDestroy=!1,this.prewarmed=!1}pause(){this.paused=!0}play(){this.paused=!1}stop(){this.restart(),this.pause()}spawn(t,e,i){ai.setFromRotationMatrix(i);let s=Sr,r=ai,n=Mr;i.decompose(s,r,n);for(let h=0;h<t;h++){for(e.burstParticleIndex=h,this.particleNum++;this.particles.length<this.particleNum;)this.rendererSettings.renderMode===_.Trail?this.particles.push(new wt):this.particles.push(new ge);let a=this.particles[this.particleNum-1];if(a.reset(),a.speedModifier=1,this.startColor.startGen(a.memory),this.startColor.genColor(a.memory,a.startColor,this.emissionState.time),a.color.copy(a.startColor),this.startSpeed.startGen(a.memory),a.startSpeed=this.startSpeed.genValue(a.memory,e.time/this.duration),this.startLife.startGen(a.memory),a.life=this.startLife.genValue(a.memory,e.time/this.duration),a.age=0,this.startSize.startGen(a.memory),this.startSize.type==="vec3function")this.startSize.genValue(a.memory,a.startSize,e.time/this.duration);else{let l=this.startSize.genValue(a.memory,e.time/this.duration);a.startSize.set(l,l,l)}if(this.startTileIndex.startGen(a.memory),a.uvTile=this.startTileIndex.genValue(a.memory),a.size.copy(a.startSize),this.rendererSettings.renderMode===_.Mesh||this.rendererSettings.renderMode===_.BillBoard||this.rendererSettings.renderMode===_.VerticalBillBoard||this.rendererSettings.renderMode===_.HorizontalBillBoard||this.rendererSettings.renderMode===_.StretchedBillBoard){let l=a;this.startRotation.startGen(a.memory),this.rendererSettings.renderMode===_.Mesh?(l.rotation instanceof A||(l.rotation=new A),this.startRotation.type==="rotation"?this.startRotation.genValue(a.memory,l.rotation,1,e.time/this.duration):l.rotation.setFromAxisAngle(vr,this.startRotation.genValue(l.memory,e.time/this.duration))):this.startRotation.type==="rotation"?l.rotation=0:l.rotation=this.startRotation.genValue(l.memory,e.time/this.duration)}else if(this.rendererSettings.renderMode===_.Trail){let l=a;this.rendererEmitterSettings.startLength.startGen(l.memory),l.length=this.rendererEmitterSettings.startLength.genValue(l.memory,e.time/this.duration)}if(this.emitterShape.initialize(a,e),this.rendererSettings.renderMode===_.Trail&&this.rendererEmitterSettings.followLocalOrigin){let l=a;l.localPosition=new v().copy(l.position)}this.worldSpace?(a.position.applyMatrix4(i),a.startSize.multiply(n).abs(),a.size.copy(a.startSize),a.velocity.multiply(n).applyMatrix3(this.normalMatrix),a.rotation&&a.rotation instanceof A&&a.rotation.multiplyQuaternions(ai,a.rotation)):this.onlyUsedByOther&&(a.parentMatrix=i);for(let l=0;l<this.behaviors.length;l++)this.behaviors[l].initialize(a,this)}}endEmit(){this.emitEnded=!0,this.autoDestroy&&(this.markForDestroy=!0),this.fire({type:"emitEnd",particleSystem:this})}dispose(){this._renderer&&this._renderer.deleteSystem(this),this.emitter.dispose(),this.emitter.parent&&this.emitter.parent.remove(this.emitter),this.fire({type:"destroy",particleSystem:this})}restart(){this.memory.length=0,this.paused=!1,this.particleNum=0,this.emissionState.isBursting=!1,this.emissionState.burstIndex=0,this.emissionState.burstWaveIndex=0,this.emissionState.time=0,this.emissionState.waitEmiting=0,this.behaviors.forEach(t=>{t.reset()}),this.emitEnded=!1,this.markForDestroy=!1,this.prewarmed=!1,this.emissionBursts.forEach(t=>t.count.startGen(this.memory)),this.emissionOverDistance.startGen(this.memory)}update(t){if(this.paused)return;let e=this.emitter;for(;e.parent;)e=e.parent;if(e.type!=="Scene"){this.dispose();return}if(this.firstTimeUpdate&&(this.firstTimeUpdate=!1,this.emitter.updateWorldMatrix(!0,!1)),this.emitEnded&&this.particleNum===0){this.markForDestroy&&this.emitter.parent&&this.dispose();return}if(this.looping&&this.prewarm&&!this.prewarmed){this.prewarmed=!0;for(let i=0;i<this.duration*Di;i++)this.update(1/Di)}t>.1&&(t=.1),this.neededToUpdateRender&&(this._renderer&&this._renderer.updateSystem(this),this.neededToUpdateRender=!1),this.onlyUsedByOther||this.emit(t,this.emissionState,this.emitter.matrixWorld),this.emitterShape.update(this,t);for(let i=0;i<this.behaviors.length;i++){this.behaviors[i].frameUpdate(t);for(let s=0;s<this.particleNum;s++)this.particles[s].died||this.behaviors[i].update(this.particles[s],t)}for(let i=0;i<this.particleNum;i++)this.rendererEmitterSettings.followLocalOrigin&&this.particles[i].localPosition?(this.particles[i].position.copy(this.particles[i].localPosition),this.particles[i].parentMatrix?this.particles[i].position.applyMatrix4(this.particles[i].parentMatrix):this.particles[i].position.applyMatrix4(this.emitter.matrixWorld)):this.particles[i].position.addScaledVector(this.particles[i].velocity,t*this.particles[i].speedModifier),this.particles[i].age+=t;if(this.rendererSettings.renderMode===_.Trail)for(let i=0;i<this.particleNum;i++)this.particles[i].update();for(let i=0;i<this.particleNum;i++){let s=this.particles[i];s.died&&(!(s instanceof wt)||s.previous.length===0)&&(this.particles[i]=this.particles[this.particleNum-1],this.particles[this.particleNum-1]=s,this.particleNum--,i--,this.fire({type:"particleDied",particleSystem:this,particle:s}))}}emit(t,e,i){e.time>this.duration&&(this.looping?(e.time-=this.duration,e.burstIndex=0,this.behaviors.forEach(r=>{r.reset()})):!this.emitEnded&&!this.onlyUsedByOther&&this.endEmit()),this.normalMatrix.getNormalMatrix(i);let s=Math.ceil(e.waitEmiting);for(this.spawn(s,e,i),e.waitEmiting-=s;e.burstIndex<this.emissionBursts.length&&this.emissionBursts[e.burstIndex].time<=e.time;){if(Math.random()<this.emissionBursts[e.burstIndex].probability){let r=this.emissionBursts[e.burstIndex].count.genValue(this.memory,this.time);e.isBursting=!0,e.burstParticleCount=r,this.spawn(r,e,i),e.isBursting=!1}e.burstIndex++}if(!this.emitEnded&&(e.waitEmiting+=t*this.emissionOverTime.genValue(this.memory,e.time/this.duration),e.previousWorldPos!=null)){this.temp.set(i.elements[12],i.elements[13],i.elements[14]),e.travelDistance+=e.previousWorldPos.distanceTo(this.temp);let r=this.emissionOverDistance.genValue(this.memory,e.time/this.duration);if(e.travelDistance*r>0){let n=Math.floor(e.travelDistance*r);e.travelDistance-=n/r,e.waitEmiting+=n}}e.previousWorldPos===void 0&&(e.previousWorldPos=new v),e.previousWorldPos.set(i.elements[12],i.elements[13],i.elements[14]),e.time+=t}toJSON(t,e={}){if((t===void 0||typeof t=="string")&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}}),t.materials[this.rendererSettings.material.uuid]=this.rendererSettings.material.toJSON(t),e.useUrlForImage&&this.texture?.source!==void 0){let n=this.texture.source;t.images[n.uuid]={uuid:n.uuid,url:this.texture.image.url}}let s;this.renderMode===_.Trail?s={startLength:this.rendererEmitterSettings.startLength.toJSON(),followLocalOrigin:this.rendererEmitterSettings.followLocalOrigin}:this.renderMode===_.Mesh?s={}:this.renderMode===_.StretchedBillBoard?s={speedFactor:this.rendererEmitterSettings.speedFactor,lengthFactor:this.rendererEmitterSettings.lengthFactor}:s={};let r=this.rendererSettings.instancingGeometry;return t.geometries&&!t.geometries[r.uuid]&&(t.geometries[r.uuid]=r.toJSON()),{version:"3.0",autoDestroy:this.autoDestroy,looping:this.looping,prewarm:this.prewarm,duration:this.duration,shape:this.emitterShape.toJSON(),startLife:this.startLife.toJSON(),startSpeed:this.startSpeed.toJSON(),startRotation:this.startRotation.toJSON(),startSize:this.startSize.toJSON(),startColor:this.startColor.toJSON(),emissionOverTime:this.emissionOverTime.toJSON(),emissionOverDistance:this.emissionOverDistance.toJSON(),emissionBursts:this.emissionBursts.map(n=>({time:n.time,count:n.count.toJSON(),probability:n.probability,interval:n.interval,cycle:n.cycle})),onlyUsedByOther:this.onlyUsedByOther,instancingGeometry:this.rendererSettings.instancingGeometry.uuid,renderOrder:this.renderOrder,renderMode:this.renderMode,rendererEmitterSettings:s,material:this.rendererSettings.material.uuid,layers:this.layers.mask,startTileIndex:this.startTileIndex.toJSON(),uTileCount:this.uTileCount,vTileCount:this.vTileCount,blendTiles:this.blendTiles,softParticles:this.rendererSettings.softParticles,softFarFade:this.rendererSettings.softFarFade,softNearFade:this.rendererSettings.softNearFade,behaviors:this.behaviors.map(n=>n.toJSON()),worldSpace:this.worldSpace}}static fromJSON(t,e,i){let s=Ri(t.shape,e),r;if(t.renderMode===_.Trail){let a=t.rendererEmitterSettings;r={startLength:a.startLength!=null?T(a.startLength):new N(30),followLocalOrigin:a.followLocalOrigin}}else t.renderMode===_.Mesh?r={}:t.renderMode===_.StretchedBillBoard?(r=t.rendererEmitterSettings,t.speedFactor!=null&&(r.speedFactor=t.speedFactor)):r={};let n=new Ce;t.layers&&(n.mask=t.layers);let h=new o({autoDestroy:t.autoDestroy,looping:t.looping,prewarm:t.prewarm,duration:t.duration,shape:s,startLife:T(t.startLife),startSpeed:T(t.startSpeed),startRotation:Yt(t.startRotation),startSize:Yt(t.startSize),startColor:Ee(t.startColor),emissionOverTime:T(t.emissionOverTime),emissionOverDistance:T(t.emissionOverDistance),emissionBursts:t.emissionBursts?.map(a=>({time:a.time,count:typeof a.count=="number"?new N(a.count):T(a.count),probability:a.probability??1,interval:a.interval??.1,cycle:a.cycle??1})),onlyUsedByOther:t.onlyUsedByOther,instancingGeometry:e.geometries[t.instancingGeometry],renderMode:t.renderMode,rendererEmitterSettings:r,renderOrder:t.renderOrder,layers:n,material:t.material?e.materials[t.material]:t.texture?new Ji({map:e.textures[t.texture],transparent:t.transparent??!0,blending:t.blending,side:Li}):new Ji({color:16777215,transparent:!0,blending:Yi,side:Li}),startTileIndex:typeof t.startTileIndex=="number"?new N(t.startTileIndex):T(t.startTileIndex),uTileCount:t.uTileCount,vTileCount:t.vTileCount,blendTiles:t.blendTiles,softParticles:t.softParticles,softFarFade:t.softFarFade,softNearFade:t.softNearFade,behaviors:[],worldSpace:t.worldSpace});return h.behaviors=t.behaviors.map(a=>{let l=Fi(a,h);return l&&l.type==="EmitSubParticleSystem"&&(i[a.subParticleSystem]=l),l}).filter(a=>a!==null),h}addBehavior(t){this.behaviors.push(t)}getRendererSettings(){return this.rendererSettings}addEventListener(t,e){this.listeners[t]||(this.listeners[t]=[]),this.listeners[t].push(e)}removeAllEventListeners(t){this.listeners[t]&&(this.listeners[t]=[])}removeEventListener(t,e){if(this.listeners[t]){let i=this.listeners[t].indexOf(e);i!==-1&&this.listeners[t].splice(i,1)}}fire(t){this.listeners[t.type]&&this.listeners[t.type].forEach(e=>e(t))}clone(){let t=[];for(let r of this.emissionBursts){let n={};Object.assign(n,r),t.push(n)}let e=[];for(let r of this.behaviors)e.push(r.clone());let i;this.renderMode===_.Trail?i={startLength:this.rendererEmitterSettings.startLength.clone(),followLocalOrigin:this.rendererEmitterSettings.followLocalOrigin}:this.renderMode===_.StretchedBillBoard?i={lengthFactor:this.rendererEmitterSettings.lengthFactor,speedFactor:this.rendererEmitterSettings.speedFactor}:i={};let s=new Ce;return s.mask=this.layers.mask,new o({autoDestroy:this.autoDestroy,looping:this.looping,duration:this.duration,shape:this.emitterShape.clone(),startLife:this.startLife.clone(),startSpeed:this.startSpeed.clone(),startRotation:this.startRotation.clone(),startSize:this.startSize.clone(),startColor:this.startColor.clone(),emissionOverTime:this.emissionOverTime.clone(),emissionOverDistance:this.emissionOverDistance.clone(),emissionBursts:t,onlyUsedByOther:this.onlyUsedByOther,instancingGeometry:this.rendererSettings.instancingGeometry,renderMode:this.renderMode,renderOrder:this.renderOrder,rendererEmitterSettings:i,material:this.rendererSettings.material,startTileIndex:this.startTileIndex,uTileCount:this.uTileCount,vTileCount:this.vTileCount,blendTiles:this.blendTiles,softParticles:this.softParticles,softFarFade:this.softFarFade,softNearFade:this.softNearFade,behaviors:e,worldSpace:this.worldSpace,layers:s})}},hi=`

#include <common>
#include <color_pars_fragment>
#include <map_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#include <alphatest_pars_fragment>

#include <tile_pars_fragment>
#include <soft_pars_fragment>

void main() {

    #include <clipping_planes_fragment>

    vec3 outgoingLight = vec3( 0.0 );
    vec4 diffuseColor = vColor;

    #include <logdepthbuf_fragment>

    #include <tile_fragment>
    #include <alphatest_fragment>

    outgoingLight = diffuseColor.rgb;

    #ifdef USE_COLOR_AS_ALPHA
    gl_FragColor = vec4( outgoingLight, diffuseColor.r );
    #else
    gl_FragColor = vec4( outgoingLight, diffuseColor.a );
    #endif

    #include <soft_fragment>
    #include <tonemapping_fragment>
}
`,Si=`
#define STANDARD

#ifdef PHYSICAL
#define IOR
#define USE_SPECULAR
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef IOR
uniform float ior;
#endif

#ifdef USE_SPECULAR
uniform float specularIntensity;
uniform vec3 specularColor;

#ifdef USE_SPECULAR_COLORMAP
uniform sampler2D specularColorMap;
#endif

#ifdef USE_SPECULAR_INTENSITYMAP
uniform sampler2D specularIntensityMap;
#endif
#endif

#ifdef USE_CLEARCOAT
uniform float clearcoat;
uniform float clearcoatRoughness;
#endif

#ifdef USE_DISPERSION
uniform float dispersion;
#endif

#ifdef USE_IRIDESCENCE
uniform float iridescence;
uniform float iridescenceIOR;
uniform float iridescenceThicknessMinimum;
uniform float iridescenceThicknessMaximum;
#endif

#ifdef USE_SHEEN
uniform vec3 sheenColor;
uniform float sheenRoughness;

#ifdef USE_SHEEN_COLORMAP
uniform sampler2D sheenColorMap;
#endif

#ifdef USE_SHEEN_ROUGHNESSMAP
uniform sampler2D sheenRoughnessMap;
#endif
#endif

#ifdef USE_ANISOTROPY
uniform vec2 anisotropyVector;

#ifdef USE_ANISOTROPYMAP
uniform sampler2D anisotropyMap;
#endif
#endif

varying vec3 vViewPosition;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

vec4 diffuseColor = vec4( diffuse, opacity );
#include <clipping_planes_fragment>

ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
vec3 totalEmissiveRadiance = emissive;

#include <logdepthbuf_fragment>
#include <map_fragment>
#include <color_fragment>
#include <alphamap_fragment>
#include <alphatest_fragment>
#include <alphahash_fragment>
#include <roughnessmap_fragment>
#include <metalnessmap_fragment>
#include <normal_fragment_begin>
#include <normal_fragment_maps>
#include <clearcoat_normal_fragment_begin>
#include <clearcoat_normal_fragment_maps>
#include <emissivemap_fragment>

// accumulation
#include <lights_physical_fragment>
#include <lights_fragment_begin>
#include <lights_fragment_maps>
#include <lights_fragment_end>

// modulation
#include <aomap_fragment>

vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;

#include <transmission_fragment>

vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;

#ifdef USE_SHEEN

// Sheen energy compensation approximation calculation can be found at the end of
// https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );

outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;

#endif

#ifdef USE_CLEARCOAT

float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );

vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );

outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;

#endif

#include <opaque_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
#include <premultiplied_alpha_fragment>
#include <dithering_fragment>
}`,_r=`
#include <common>
#include <color_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#include <tile_pars_vertex>
#include <soft_pars_vertex>

attribute vec3 offset;
attribute float rotation;
attribute vec3 size;

void main() {

    vec2 alignedPosition = position.xy * size.xy;

    vec2 rotatedPosition;
    rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
    rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
#ifdef HORIZONTAL
    vec4 mvPosition = modelMatrix * vec4( offset, 1.0 );
    mvPosition.x += rotatedPosition.x;
    mvPosition.z -= rotatedPosition.y;
    mvPosition = viewMatrix * mvPosition;
#elif defined(VERTICAL)
    vec4 mvPosition = modelMatrix * vec4( offset, 1.0 );
    mvPosition.y += rotatedPosition.y;
    mvPosition = viewMatrix * mvPosition;
    mvPosition.x += rotatedPosition.x;
#else
    vec4 mvPosition = modelViewMatrix * vec4( offset, 1.0 );
    mvPosition.xy += rotatedPosition;
#endif

	vColor = color;

	gl_Position = projectionMatrix * mvPosition;

	#include <logdepthbuf_vertex>

	#include <clipping_planes_vertex>

	#include <tile_vertex>
	#include <soft_vertex>
}
`,wr=`
#include <common>
#include <color_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <tile_pars_vertex>
#include <soft_pars_vertex>

attribute vec3 offset;
attribute vec4 rotation;
attribute vec3 size;
// attribute vec4 color;

void main() {

    float x2 = rotation.x + rotation.x, y2 = rotation.y + rotation.y, z2 = rotation.z + rotation.z;
    float xx = rotation.x * x2, xy = rotation.x * y2, xz = rotation.x * z2;
    float yy = rotation.y * y2, yz = rotation.y * z2, zz = rotation.z * z2;
    float wx = rotation.w * x2, wy = rotation.w * y2, wz = rotation.w * z2;
    float sx = size.x, sy = size.y, sz = size.z;

    mat4 matrix = mat4(( 1.0 - ( yy + zz ) ) * sx, ( xy + wz ) * sx, ( xz - wy ) * sx, 0.0,  // 1. column
                      ( xy - wz ) * sy, ( 1.0 - ( xx + zz ) ) * sy, ( yz + wx ) * sy, 0.0,  // 2. column
                      ( xz + wy ) * sz, ( yz - wx ) * sz, ( 1.0 - ( xx + yy ) ) * sz, 0.0,  // 3. column
                      offset.x, offset.y, offset.z, 1.0);

    vec4 mvPosition = modelViewMatrix * (matrix * vec4( position, 1.0 ));

	vColor = color;

	gl_Position = projectionMatrix * mvPosition;

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
    #include <tile_vertex>
    #include <soft_vertex>
}
`,Mi=`
#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>

attribute vec3 offset;
attribute vec4 rotation;
attribute vec3 size;
#include <tile_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

    #include <tile_vertex>
    float x2 = rotation.x + rotation.x, y2 = rotation.y + rotation.y, z2 = rotation.z + rotation.z;
    float xx = rotation.x * x2, xy = rotation.x * y2, xz = rotation.x * z2;
    float yy = rotation.y * y2, yz = rotation.y * z2, zz = rotation.z * z2;
    float wx = rotation.w * x2, wy = rotation.w * y2, wz = rotation.w * z2;
    float sx = size.x, sy = size.y, sz = size.z;

    mat4 particleMatrix = mat4(( 1.0 - ( yy + zz ) ) * sx, ( xy + wz ) * sx, ( xz - wy ) * sx, 0.0,  // 1. column
                      ( xy - wz ) * sy, ( 1.0 - ( xx + zz ) ) * sy, ( yz + wx ) * sy, 0.0,  // 2. column
                      ( xz + wy ) * sz, ( yz - wx ) * sz, ( 1.0 - ( xx + yy ) ) * sz, 0.0,  // 3. column
                      offset.x, offset.y, offset.z, 1.0);

#include <color_vertex>
#include <morphinstance_vertex>
#include <morphcolor_vertex>
#include <batching_vertex>

#include <beginnormal_vertex>
#include <morphnormal_vertex>
#include <skinbase_vertex>
#include <skinnormal_vertex>

	// replace defaultnormal_vertex
	vec3 transformedNormal = objectNormal;
    mat3 m = mat3( particleMatrix );
    transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
    transformedNormal = m * transformedNormal;
    transformedNormal = normalMatrix * transformedNormal;
    #ifdef FLIP_SIDED
        transformedNormal = - transformedNormal;
    #endif
    #ifdef USE_TANGENT
        vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
        #ifdef FLIP_SIDED
        transformedTangent = - transformedTangent;
        #endif
    #endif

	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>

	// replace include <project_vertex>
  vec4 mvPosition = vec4( transformed, 1.0 );
  mvPosition = modelViewMatrix * (particleMatrix * mvPosition);
	gl_Position = projectionMatrix * mvPosition;

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
    vWorldPosition = worldPosition.xyz;
#endif
}
`,zr=`
#include <common>
#include <color_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#include <tile_pars_vertex>
#include <soft_pars_vertex>

attribute vec3 offset;
attribute float rotation;
attribute vec3 size;
attribute vec4 velocity;

uniform float speedFactor;

void main() {
    float lengthFactor = velocity.w;
    float avgSize = (size.x + size.y) * 0.5;
#ifdef USE_SKEW
    vec4 mvPosition = modelViewMatrix * vec4( offset, 1.0 );
    vec3 viewVelocity = normalMatrix * velocity.xyz;

    vec3 scaledPos = vec3(position.xy * size.xy, position.z);
    float vlength = length(viewVelocity);
    vec3 projVelocity =  dot(scaledPos, viewVelocity) * viewVelocity / vlength;
    mvPosition.xyz += scaledPos + projVelocity * (speedFactor / avgSize + lengthFactor / vlength);
#else
    vec4 mvPosition = modelViewMatrix * vec4( offset, 1.0 );
    vec3 viewVelocity = normalMatrix * velocity.xyz;
    float vlength = length(viewVelocity);
    mvPosition.xyz += position.y * normalize(cross(mvPosition.xyz, viewVelocity)) * avgSize; // switch the cross to  match unity implementation
    mvPosition.xyz -= (position.x + 0.5) * viewVelocity * (1.0 + lengthFactor / vlength) * avgSize; // minus position.x to match unity implementation
#endif
	vColor = color;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <tile_vertex>
	#include <soft_vertex>
}
`;function di(o){return o===0?"uv":`uv${o}`}var mi=class extends Es{constructor(t){super(t)}onBeforeCompile(t,e){super.onBeforeCompile(t,e),t.vertexShader=Mi,t.fragmentShader=Si}},fi=class extends Ps{constructor(t){super(t)}onBeforeCompile(t,e){super.onBeforeCompile(t,e),t.vertexShader=Mi,t.fragmentShader=Si}},pi=class extends Be{constructor(t){super(t),this.vector_=new v,this.vector2_=new v,this.vector3_=new v,this.quaternion_=new A,this.quaternion2_=new A,this.quaternion3_=new A,this.rotationMat_=new nt,this.rotationMat2_=new nt,this.maxParticles=1e3,this.setupBuffers(),this.rebuildMaterial()}buildExpandableBuffers(){this.offsetBuffer=new lt(new Float32Array(this.maxParticles*3),3),this.offsetBuffer.setUsage(L),this.geometry.setAttribute("offset",this.offsetBuffer),this.colorBuffer=new lt(new Float32Array(this.maxParticles*4),4),this.colorBuffer.setUsage(L),this.geometry.setAttribute("color",this.colorBuffer),this.settings.renderMode===_.Mesh?(this.rotationBuffer=new lt(new Float32Array(this.maxParticles*4),4),this.rotationBuffer.setUsage(L),this.geometry.setAttribute("rotation",this.rotationBuffer)):(this.settings.renderMode===_.BillBoard||this.settings.renderMode===_.HorizontalBillBoard||this.settings.renderMode===_.VerticalBillBoard||this.settings.renderMode===_.StretchedBillBoard)&&(this.rotationBuffer=new lt(new Float32Array(this.maxParticles),1),this.rotationBuffer.setUsage(L),this.geometry.setAttribute("rotation",this.rotationBuffer)),this.sizeBuffer=new lt(new Float32Array(this.maxParticles*3),3),this.sizeBuffer.setUsage(L),this.geometry.setAttribute("size",this.sizeBuffer),this.uvTileBuffer=new lt(new Float32Array(this.maxParticles),1),this.uvTileBuffer.setUsage(L),this.geometry.setAttribute("uvTile",this.uvTileBuffer),this.settings.renderMode===_.StretchedBillBoard&&(this.velocityBuffer=new lt(new Float32Array(this.maxParticles*4),4),this.velocityBuffer.setUsage(L),this.geometry.setAttribute("velocity",this.velocityBuffer))}setupBuffers(){this.geometry&&this.geometry.dispose(),this.geometry=new Cs,this.geometry.setIndex(this.settings.instancingGeometry.getIndex()),this.settings.instancingGeometry.hasAttribute("normal")&&this.geometry.setAttribute("normal",this.settings.instancingGeometry.getAttribute("normal")),this.geometry.setAttribute("position",this.settings.instancingGeometry.getAttribute("position")),this.settings.instancingGeometry.hasAttribute("uv")&&this.geometry.setAttribute("uv",this.settings.instancingGeometry.getAttribute("uv")),this.buildExpandableBuffers()}expandBuffers(t){for(;t>=this.maxParticles;)this.maxParticles*=2;this.setupBuffers()}rebuildMaterial(){this.layers.mask=this.settings.layers.mask;let t={},e={};this.settings.material.type!=="MeshStandardMaterial"&&this.settings.material.type!=="MeshPhysicalMaterial"&&(t.map=new tt(this.settings.material.map)),this.settings.material.alphaTest&&(e.USE_ALPHATEST="",t.alphaTest=new tt(this.settings.material.alphaTest)),e.USE_UV="";let i=this.settings.uTileCount,s=this.settings.vTileCount;(i>1||s>1)&&(e.UV_TILE="",t.tileCount=new tt(new ht(i,s))),this.settings.material.defines&&this.settings.material.defines.USE_COLOR_AS_ALPHA!==void 0&&(e.USE_COLOR_AS_ALPHA=""),this.settings.material.normalMap&&(e.USE_NORMALMAP="",e.NORMALMAP_UV=di(this.settings.material.normalMap.channel),t.normalMapTransform=new tt(new nt().copy(this.settings.material.normalMap.matrix))),this.settings.material.map&&(e.USE_MAP="",this.settings.blendTiles&&(e.TILE_BLEND=""),e.MAP_UV=di(this.settings.material.map.channel),t.mapTransform=new tt(new nt().copy(this.settings.material.map.matrix))),e.USE_COLOR_ALPHA="";let r;if(this.settings.softParticles){e.SOFT_PARTICLES="";let h=this.settings.softNearFade,a=1/(this.settings.softFarFade-this.settings.softNearFade);t.softParams=new tt(new ht(h,a)),t.depthTexture=new tt(null);let l=t.projParams=new tt(new D);r=(c,u,f)=>{l.value.set(f.near,f.far,0,0)}}let n=!1;if(this.settings.renderMode===_.BillBoard||this.settings.renderMode===_.VerticalBillBoard||this.settings.renderMode===_.HorizontalBillBoard||this.settings.renderMode===_.Mesh){let h,a;this.settings.renderMode===_.Mesh?this.settings.material.type==="MeshStandardMaterial"||this.settings.material.type==="MeshPhysicalMaterial"?(e.USE_COLOR="",h=Mi,a=Si,n=!0):(h=wr,a=hi):(h=_r,a=hi),this.settings.renderMode===_.VerticalBillBoard?e.VERTICAL="":this.settings.renderMode===_.HorizontalBillBoard&&(e.HORIZONTAL="");let l=!1;this.settings.renderMode===_.Mesh&&(this.settings.material.type==="MeshStandardMaterial"?(this.material=new mi({}),this.material.copy(this.settings.material),this.material.uniforms=t,this.material.defines=e,l=!0):this.settings.material.type==="MeshPhysicalMaterial"&&(this.material=new fi({}),this.material.copy(this.settings.material),this.material.uniforms=t,this.material.defines=e,l=!0)),l||(this.material=new li({uniforms:t,defines:e,vertexShader:h,fragmentShader:a,transparent:this.settings.material.transparent,depthWrite:!this.settings.material.transparent,blending:this.settings.material.blending,blendDst:this.settings.material.blendDst,blendSrc:this.settings.material.blendSrc,blendEquation:this.settings.material.blendEquation,premultipliedAlpha:this.settings.material.premultipliedAlpha,side:this.settings.material.side,alphaTest:this.settings.material.alphaTest,depthTest:this.settings.material.depthTest,lights:n}))}else if(this.settings.renderMode===_.StretchedBillBoard)t.speedFactor=new tt(1),this.material=new li({uniforms:t,defines:e,vertexShader:zr,fragmentShader:hi,transparent:this.settings.material.transparent,depthWrite:!this.settings.material.transparent,blending:this.settings.material.blending,blendDst:this.settings.material.blendDst,blendSrc:this.settings.material.blendSrc,blendEquation:this.settings.material.blendEquation,premultipliedAlpha:this.settings.material.premultipliedAlpha,side:this.settings.material.side,alphaTest:this.settings.material.alphaTest,depthTest:this.settings.material.depthTest});else throw new Error("render mode unavailable");this.material&&r&&(this.material.onBeforeRender=r)}update(){let t=0,e=0,i=this.getVisibleSystems();for(let s of i)e+=s.particleNum;e>this.maxParticles&&this.expandBuffers(e);for(let s of i){s.emitter.updateMatrixWorld&&(s.emitter.updateWorldMatrix(!0,!1),s.emitter.updateMatrixWorld(!0));let r=s.particles,n=s.particleNum,h=this.quaternion2_,a=this.vector2_,l=this.vector3_;s.emitter.matrixWorld.decompose(a,h,l),this.rotationMat_.setFromMatrix4(s.emitter.matrixWorld);for(let c=0;c<n;c++,t++){let u=r[c];if(this.settings.renderMode===_.Mesh){let d;if(s.worldSpace)d=u.rotation;else{let m;u.parentMatrix?m=this.quaternion3_.setFromRotationMatrix(u.parentMatrix):m=h,d=this.quaternion_,d.copy(m).multiply(u.rotation)}this.rotationBuffer.setXYZW(t,d.x,d.y,d.z,d.w)}else(this.settings.renderMode===_.StretchedBillBoard||this.settings.renderMode===_.VerticalBillBoard||this.settings.renderMode===_.HorizontalBillBoard||this.settings.renderMode===_.BillBoard)&&this.rotationBuffer.setX(t,u.rotation);let f;if(s.worldSpace?f=u.position:(f=this.vector_,u.parentMatrix?f.copy(u.position).applyMatrix4(u.parentMatrix):f.copy(u.position).applyMatrix4(s.emitter.matrixWorld)),this.offsetBuffer.setXYZ(t,f.x,f.y,f.z),this.colorBuffer.setXYZW(t,u.color.x,u.color.y,u.color.z,u.color.w),s.worldSpace?this.sizeBuffer.setXYZ(t,u.size.x,u.size.y,u.size.z):u.parentMatrix?this.sizeBuffer.setXYZ(t,u.size.x,u.size.y,u.size.z):this.sizeBuffer.setXYZ(t,u.size.x*Math.abs(l.x),u.size.y*Math.abs(l.y),u.size.z*Math.abs(l.z)),this.uvTileBuffer.setX(t,u.uvTile),this.settings.renderMode===_.StretchedBillBoard&&this.velocityBuffer){let d=s.rendererEmitterSettings.speedFactor;d===0&&(d=.001);let m=s.rendererEmitterSettings.lengthFactor,p;s.worldSpace?p=u.velocity:(p=this.vector_,u.parentMatrix?(this.rotationMat2_.setFromMatrix4(u.parentMatrix),p.copy(u.velocity).applyMatrix3(this.rotationMat2_)):p.copy(u.velocity).applyMatrix3(this.rotationMat_)),this.velocityBuffer.setXYZW(t,p.x*d,p.y*d,p.z*d,m)}}}this.geometry.instanceCount=t,t>0&&(this.offsetBuffer.clearUpdateRanges(),this.offsetBuffer.addUpdateRange(0,t*3),this.offsetBuffer.needsUpdate=!0,this.sizeBuffer.clearUpdateRanges(),this.sizeBuffer.addUpdateRange(0,t*3),this.sizeBuffer.needsUpdate=!0,this.colorBuffer.clearUpdateRanges(),this.colorBuffer.addUpdateRange(0,t*4),this.colorBuffer.needsUpdate=!0,this.uvTileBuffer.clearUpdateRanges(),this.uvTileBuffer.addUpdateRange(0,t),this.uvTileBuffer.needsUpdate=!0,this.settings.renderMode===_.StretchedBillBoard&&this.velocityBuffer&&(this.velocityBuffer.clearUpdateRanges(),this.velocityBuffer.addUpdateRange(0,t*4),this.velocityBuffer.needsUpdate=!0),this.settings.renderMode===_.Mesh?(this.rotationBuffer.clearUpdateRanges(),this.rotationBuffer.addUpdateRange(0,t*4),this.rotationBuffer.needsUpdate=!0):(this.settings.renderMode===_.StretchedBillBoard||this.settings.renderMode===_.HorizontalBillBoard||this.settings.renderMode===_.VerticalBillBoard||this.settings.renderMode===_.BillBoard)&&(this.rotationBuffer.clearUpdateRanges(),this.rotationBuffer.addUpdateRange(0,t),this.rotationBuffer.needsUpdate=!0))}dispose(){this.geometry.dispose()}},br=`

#include <common>
#include <tile_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

uniform sampler2D alphaMap;
uniform float useAlphaMap;
uniform float visibility;
uniform float alphaTest;

varying vec4 vColor;

void main() {
    #include <clipping_planes_fragment>
    #include <logdepthbuf_fragment>

    vec4 diffuseColor = vColor;

    #ifdef USE_MAP
    #include <tile_fragment>
    #ifndef USE_COLOR_AS_ALPHA
    #endif
    #endif
    if( useAlphaMap == 1. ) diffuseColor.a *= texture2D( alphaMap, vUv).a;
    if( diffuseColor.a < alphaTest ) discard;
    gl_FragColor = diffuseColor;

    #include <fog_fragment>
    #include <tonemapping_fragment>
}`,Or=`
#include <common>
#include <tile_pars_vertex>
#include <color_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <fog_pars_vertex>

attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;

uniform vec2 resolution;
uniform float lineWidth;
uniform float sizeAttenuation;

vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
}

void main() {

    #include <tile_vertex>

    float aspect = resolution.x / resolution.y;

    vColor = color;

    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4( position, 1.0 );
    vec4 prevPos = m * vec4( previous, 1.0 );
    vec4 nextPos = m * vec4( next, 1.0 );

    vec2 currentP = fix( finalPosition, aspect );
    vec2 prevP = fix( prevPos, aspect );
    vec2 nextP = fix( nextPos, aspect );

    float w = lineWidth * width;

    vec2 dir;
    if( nextP == currentP ) dir = normalize( currentP - prevP );
    else if( prevP == currentP ) dir = normalize( nextP - currentP );
    else {
        vec2 dir1 = normalize( currentP - prevP );
        vec2 dir2 = normalize( nextP - currentP );
        dir = normalize( dir1 + dir2 );

        vec2 perp = vec2( -dir1.y, dir1.x );
        vec2 miter = vec2( -dir.y, dir.x );
        //w = clamp( w / dot( miter, perp ), 0., 4., * lineWidth * width );

    }

    //vec2 normal = ( cross( vec3( dir, 0. ) vec3( 0., 0., 1. ) ) ).xy;
    vec4 normal = vec4( -dir.y, dir.x, 0., 1. );
    normal.xy *= .5 * w;
    normal *= projectionMatrix;
    if( sizeAttenuation == 0. ) {
        normal.xy *= finalPosition.w;
        normal.xy /= ( vec4( resolution, 0., 1. ) * projectionMatrix ).xy;
    }

    finalPosition.xy += normal.xy * side;

    gl_Position = finalPosition;

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

	#include <fog_vertex>
}`,yi=class extends Be{constructor(t){super(t),this.vector_=new v,this.vector2_=new v,this.vector3_=new v,this.quaternion_=new A,this.maxParticles=1e4,this.setupBuffers(),this.rebuildMaterial()}setupBuffers(){this.geometry&&this.geometry.dispose(),this.geometry=new Us,this.indexBuffer=new mt(new Uint32Array(this.maxParticles*6),1),this.indexBuffer.setUsage(L),this.geometry.setIndex(this.indexBuffer),this.positionBuffer=new mt(new Float32Array(this.maxParticles*6),3),this.positionBuffer.setUsage(L),this.geometry.setAttribute("position",this.positionBuffer),this.previousBuffer=new mt(new Float32Array(this.maxParticles*6),3),this.previousBuffer.setUsage(L),this.geometry.setAttribute("previous",this.previousBuffer),this.nextBuffer=new mt(new Float32Array(this.maxParticles*6),3),this.nextBuffer.setUsage(L),this.geometry.setAttribute("next",this.nextBuffer),this.widthBuffer=new mt(new Float32Array(this.maxParticles*2),1),this.widthBuffer.setUsage(L),this.geometry.setAttribute("width",this.widthBuffer),this.sideBuffer=new mt(new Float32Array(this.maxParticles*2),1),this.sideBuffer.setUsage(L),this.geometry.setAttribute("side",this.sideBuffer),this.uvBuffer=new mt(new Float32Array(this.maxParticles*4),2),this.uvBuffer.setUsage(L),this.geometry.setAttribute("uv",this.uvBuffer),this.colorBuffer=new mt(new Float32Array(this.maxParticles*8),4),this.colorBuffer.setUsage(L),this.geometry.setAttribute("color",this.colorBuffer)}expandBuffers(t){for(;t>=this.maxParticles;)this.maxParticles*=2;this.setupBuffers()}rebuildMaterial(){this.layers.mask=this.settings.layers.mask;let t={lineWidth:{value:1},map:{value:null},useMap:{value:0},alphaMap:{value:null},useAlphaMap:{value:0},resolution:{value:new ht(1,1)},sizeAttenuation:{value:1},visibility:{value:1},alphaTest:{value:0}},e={};if(e.USE_UV="",e.USE_COLOR_ALPHA="",this.settings.material.map&&(e.USE_MAP="",e.MAP_UV=di(this.settings.material.map.channel),t.map=new tt(this.settings.material.map),t.mapTransform=new tt(new nt().copy(this.settings.material.map.matrix))),this.settings.material.defines&&this.settings.material.defines.USE_COLOR_AS_ALPHA!==void 0&&(e.USE_COLOR_AS_ALPHA=""),this.settings.renderMode===_.Trail)this.material=new li({uniforms:t,defines:e,vertexShader:Or,fragmentShader:br,transparent:this.settings.material.transparent,depthWrite:!this.settings.material.transparent,side:this.settings.material.side,blending:this.settings.material.blending||Yi,blendDst:this.settings.material.blendDst,blendSrc:this.settings.material.blendSrc,blendEquation:this.settings.material.blendEquation,premultipliedAlpha:this.settings.material.premultipliedAlpha});else throw new Error("render mode unavailable")}update(){let t=0,e=0,i=0,s=this.getVisibleSystems();for(let r of s)for(let n=0;n<r.particleNum;n++)i+=r.particles[n].previous.length*2;i>this.maxParticles&&this.expandBuffers(i);for(let r of s){r.emitter.updateMatrixWorld&&(r.emitter.updateWorldMatrix(!0,!1),r.emitter.updateMatrixWorld(!0));let n=this.quaternion_,h=this.vector2_,a=this.vector3_;r.emitter.matrixWorld.decompose(h,n,a);let l=r.particles,c=r.particleNum,u=this.settings.uTileCount,f=this.settings.vTileCount,d=1/u,m=1/f;for(let p=0;p<c;p++){let y=l[p],x=y.uvTile%f,z=Math.floor(y.uvTile/f+.001),b=y.previous.values(),w=b.next(),M=w.value,g=M;w.done||(w=b.next());let S;w.value!==void 0?S=w.value:S=g;for(let O=0;O<y.previous.length;O++,t+=2){if(this.positionBuffer.setXYZ(t,g.position.x,g.position.y,g.position.z),this.positionBuffer.setXYZ(t+1,g.position.x,g.position.y,g.position.z),r.worldSpace?(this.positionBuffer.setXYZ(t,g.position.x,g.position.y,g.position.z),this.positionBuffer.setXYZ(t+1,g.position.x,g.position.y,g.position.z)):(y.parentMatrix?this.vector_.copy(g.position).applyMatrix4(y.parentMatrix):this.vector_.copy(g.position).applyMatrix4(r.emitter.matrixWorld),this.positionBuffer.setXYZ(t,this.vector_.x,this.vector_.y,this.vector_.z),this.positionBuffer.setXYZ(t+1,this.vector_.x,this.vector_.y,this.vector_.z)),r.worldSpace?(this.previousBuffer.setXYZ(t,M.position.x,M.position.y,M.position.z),this.previousBuffer.setXYZ(t+1,M.position.x,M.position.y,M.position.z)):(y.parentMatrix?this.vector_.copy(M.position).applyMatrix4(y.parentMatrix):this.vector_.copy(M.position).applyMatrix4(r.emitter.matrixWorld),this.previousBuffer.setXYZ(t,this.vector_.x,this.vector_.y,this.vector_.z),this.previousBuffer.setXYZ(t+1,this.vector_.x,this.vector_.y,this.vector_.z)),r.worldSpace?(this.nextBuffer.setXYZ(t,S.position.x,S.position.y,S.position.z),this.nextBuffer.setXYZ(t+1,S.position.x,S.position.y,S.position.z)):(y.parentMatrix?this.vector_.copy(S.position).applyMatrix4(y.parentMatrix):this.vector_.copy(S.position).applyMatrix4(r.emitter.matrixWorld),this.nextBuffer.setXYZ(t,this.vector_.x,this.vector_.y,this.vector_.z),this.nextBuffer.setXYZ(t+1,this.vector_.x,this.vector_.y,this.vector_.z)),this.sideBuffer.setX(t,1),this.sideBuffer.setX(t+1,-1),r.worldSpace)this.widthBuffer.setX(t,g.size),this.widthBuffer.setX(t+1,g.size);else if(y.parentMatrix)this.widthBuffer.setX(t,g.size),this.widthBuffer.setX(t+1,g.size);else{let E=(Math.abs(a.x)+Math.abs(a.y)+Math.abs(a.z))/3;this.widthBuffer.setX(t,g.size*E),this.widthBuffer.setX(t+1,g.size*E)}this.uvBuffer.setXY(t,(O/y.previous.length+x)*d,(f-z-1)*m),this.uvBuffer.setXY(t+1,(O/y.previous.length+x)*d,(f-z)*m),this.colorBuffer.setXYZW(t,g.color.x,g.color.y,g.color.z,g.color.w),this.colorBuffer.setXYZW(t+1,g.color.x,g.color.y,g.color.z,g.color.w),O+1<y.previous.length&&(this.indexBuffer.setX(e*3,t),this.indexBuffer.setX(e*3+1,t+1),this.indexBuffer.setX(e*3+2,t+2),e++,this.indexBuffer.setX(e*3,t+2),this.indexBuffer.setX(e*3+1,t+1),this.indexBuffer.setX(e*3+2,t+3),e++),M=g,g=S,w.done||(w=b.next(),w.value!==void 0&&(S=w.value))}}}this.positionBuffer.clearUpdateRanges(),this.positionBuffer.addUpdateRange(0,t*3),this.positionBuffer.needsUpdate=!0,this.previousBuffer.clearUpdateRanges(),this.previousBuffer.addUpdateRange(0,t*3),this.previousBuffer.needsUpdate=!0,this.nextBuffer.clearUpdateRanges(),this.nextBuffer.addUpdateRange(0,t*3),this.nextBuffer.needsUpdate=!0,this.sideBuffer.clearUpdateRanges(),this.sideBuffer.addUpdateRange(0,t),this.sideBuffer.needsUpdate=!0,this.widthBuffer.clearUpdateRanges(),this.widthBuffer.addUpdateRange(0,t),this.widthBuffer.needsUpdate=!0,this.uvBuffer.clearUpdateRanges(),this.uvBuffer.addUpdateRange(0,t*2),this.uvBuffer.needsUpdate=!0,this.colorBuffer.clearUpdateRanges(),this.colorBuffer.addUpdateRange(0,t*4),this.colorBuffer.needsUpdate=!0,this.indexBuffer.clearUpdateRanges(),this.indexBuffer.addUpdateRange(0,e*3),this.indexBuffer.needsUpdate=!0,this.geometry.setDrawRange(0,e*3)}dispose(){this.geometry.dispose()}},gi=class o extends vi{constructor(){super(),this.batches=[],this.systemToBatchIndex=new Map,this.type="BatchedRenderer",this.depthTexture=null}static equals(t,e){return t.material.side===e.material.side&&t.material.blending===e.material.blending&&t.material.blendSrc===e.material.blendSrc&&t.material.blendDst===e.material.blendDst&&t.material.blendEquation===e.material.blendEquation&&t.material.premultipliedAlpha===e.material.premultipliedAlpha&&t.material.transparent===e.material.transparent&&t.material.depthTest===e.material.depthTest&&t.material.type===e.material.type&&t.material.alphaTest===e.material.alphaTest&&t.material.map===e.material.map&&t.renderMode===e.renderMode&&t.blendTiles===e.blendTiles&&t.softParticles===e.softParticles&&t.softFarFade===e.softFarFade&&t.softNearFade===e.softNearFade&&t.uTileCount===e.uTileCount&&t.vTileCount===e.vTileCount&&t.instancingGeometry===e.instancingGeometry&&t.renderOrder===e.renderOrder&&t.layers.mask===e.layers.mask}addSystem(t){t._renderer=this;let e=t.getRendererSettings();for(let s=0;s<this.batches.length;s++)if(o.equals(this.batches[s].settings,e)){this.batches[s].addSystem(t),this.systemToBatchIndex.set(t,s);return}let i;switch(e.renderMode){case _.Trail:i=new yi(e);break;case _.Mesh:case _.BillBoard:case _.VerticalBillBoard:case _.HorizontalBillBoard:case _.StretchedBillBoard:i=new pi(e);break}this.depthTexture&&i.applyDepthTexture(this.depthTexture),i.addSystem(t),this.batches.push(i),this.systemToBatchIndex.set(t,this.batches.length-1),this.add(i)}deleteSystem(t){let e=this.systemToBatchIndex.get(t);e!=null&&(this.batches[e].removeSystem(t),this.systemToBatchIndex.delete(t))}setDepthTexture(t){this.depthTexture=t;for(let e of this.batches)e.applyDepthTexture(t)}updateSystem(t){this.deleteSystem(t),this.addSystem(t)}update(t){this.systemToBatchIndex.forEach((e,i)=>{i.update(t)});for(let e=0;e<this.batches.length;e++)this.batches[e].update()}},Cr=gi,xi=class o extends Hi{constructor(){super(),this.type="QuarksPrefab",this.animationData=[],this.isPlaying=!1,this.currentTime=-1e-5,this.timeScale=1,this.duration=0,this._mixers=new Map,this._tempAnimationJSON=[],this._clock=new Bs(!0)}registerBatchedRenderer(t){this._batchedRenderer=t}getOrCreateMixer(t){if(!this._mixers.has(t)){let e=new Rs(t);this._mixers.set(t,e)}return this._mixers.get(t)}addThreeAnimation(t,e,i=0,s=e.duration,r=!1){let n=this.getOrCreateMixer(t),h=n.clipAction(e);r||(h.setLoop(ks,1),h.clampWhenFinished=!0);let a={startTime:i,duration:s,type:"three",loop:r,target:t,clip:e,mixer:n,action:h};return this.animationData.push(a),this.updateDuration(),a}addParticleSystemAnimation(t,e=0,i=0,s=!1){i<=0&&(i=t.system.duration);let r={startTime:e,duration:i,type:"ps",loop:s,target:t};return this.animationData.push(r),this.pause(),this.updateDuration(),r}removeAnimation(t){this.animationData.splice(t,1),this.updateDuration()}play(){this.isPlaying||(this.isPlaying=!0)}pause(){this.isPlaying&&(this.isPlaying=!1,this.animationData.forEach(t=>{t.target&&(t.type==="ps"&&!t.target.system.paused?t.target.system.pause():t.type==="three"&&t.action&&t.action.isRunning()&&(t.action.paused=!0))}))}stop(){this.pause(),this.currentTime=-1e-5,this.animationData.forEach(t=>{t.type==="ps"&&t.target?t.target.system.stop():t.type==="three"&&t.mixer&&t.action&&t.action.reset()})}update(t){if(!this.isPlaying)return;let e=t!==void 0?t:this._clock.getDelta();this.currentTime+=e*this.timeScale,this.currentTime>this.duration&&this.stop();let i=new Set;this.animationData.forEach(s=>{let{startTime:r,duration:n,type:h,loop:a,target:l,action:c,mixer:u}=s,f=r+n,d=this.currentTime>=r,m=this.currentTime>f,p=Math.abs(this.currentTime-r)<e;h==="three"&&c&&u?d&&!m?(p?(c.reset(),c.play()):c.paused&&(c.paused=!1,c.play()),this.currentTime-r,i.add(u)):m&&(c.paused=!0):h==="ps"&&l&&(d&&!m?p&&s.target.system.restart():m&&s.target.system.endEmit())}),i.forEach(s=>{s.update(e)})}setTime(t){let e=this.currentTime;this.currentTime=t,this.animationData.forEach(i=>{let{startTime:s,duration:r,type:n,target:h,action:a,mixer:l}=i;if(n==="three"&&a&&l){if(a.reset(),t>=s&&t<s+r){let c=t-s;a.time=c,a.play(),l.update(0),a.paused=!this.isPlaying}}else n==="ps"&&h&&(t>=s&&t<s+r?(e<s||e>=s+r)&&h.system.restart():h.system.endEmit())})}getDuration(){return this.duration}updateDuration(){let t=0;this.animationData.forEach(e=>{let i=e.startTime+e.duration;i>t&&(t=i)}),this.duration=t}resolveReferences(t){this._tempAnimationJSON.forEach(e=>{let i;if(t.traverse(s=>{s.uuid===e.targetUUID&&(i=s)}),i)if(e.type==="three"&&e.clipUUID){let s;i.animations&&(s=i.animations.find(r=>r.uuid===e.clipUUID)),s&&this.addThreeAnimation(i,s,e.startTime,e.duration,e.loop)}else e.type==="ps"&&this.addParticleSystemAnimation(i,e.startTime,e.duration,e.loop)}),this.updateDuration(),this._tempAnimationJSON=[]}toJSON(){let t=super.toJSON();return t.object.animationData=this.animationData.map(e=>({startTime:e.startTime,duration:e.duration,type:e.type,targetUUID:e.target.uuid,clipUUID:e.clip?.uuid,loop:e.loop})),t}static fromJSON(t){let e=new o;return t.animationData&&(e._tempAnimationJSON=t.animationData),e}},Gi=class extends Fs{constructor(t){super(t)}linkReference(t){let e={};t.traverse(function(i){e[i.uuid]=i}),t.traverse(function(i){if(i.type==="ParticleEmitter"){let s=i.system;s.emitterShape;for(let r=0;r<s.behaviors.length;r++)s.behaviors[r]instanceof zt&&(s.behaviors[r].subParticleSystem=e[s.behaviors[r].subParticleSystem])}})}parse(t,e){let i=super.parse(t,e);return this.linkReference(i),i}parseObject(t,e,i,s,r){let n;function h(m){return e[m]===void 0&&console.warn("THREE.ObjectLoader: Undefined geometry",m),e[m]}function a(m){if(m!==void 0){if(Array.isArray(m)){let p=[];for(let y=0,x=m.length;y<x;y++){let z=m[y];i[z]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",z),p.push(i[z])}return p}return i[m]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",m),i[m]}}function l(m){return s[m]===void 0&&console.warn("THREE.ObjectLoader: Undefined texture",m),s[m]}let c,u,f={textures:s,geometries:e,materials:i},d={};switch(t.type){case"QuarksPrefab":n=xi.fromJSON(t);break;case"ParticleEmitter":n=ui.fromJSON(t.ps,f,d).emitter;break;case"Scene":n=new nr,t.background!==void 0&&(Number.isInteger(t.background)?n.background=new or(t.background):n.background=l(t.background)),t.environment!==void 0&&(n.environment=l(t.environment)),t.fog!==void 0&&(t.fog.type==="Fog"?n.fog=new ar(t.fog.color,t.fog.near,t.fog.far):t.fog.type==="FogExp2"&&(n.fog=new hr(t.fog.color,t.fog.density)),t.fog.name!==""&&(n.fog.name=t.fog.name)),t.backgroundBlurriness!==void 0&&(n.backgroundBlurriness=t.backgroundBlurriness),t.backgroundIntensity!==void 0&&(n.backgroundIntensity=t.backgroundIntensity),t.backgroundRotation!==void 0&&n.backgroundRotation.fromArray(t.backgroundRotation),t.environmentIntensity!==void 0&&(n.environmentIntensity=t.environmentIntensity),t.environmentRotation!==void 0&&n.environmentRotation.fromArray(t.environmentRotation);break;case"PerspectiveCamera":n=new rr(t.fov,t.aspect,t.near,t.far),t.focus!==void 0&&(n.focus=t.focus),t.zoom!==void 0&&(n.zoom=t.zoom),t.filmGauge!==void 0&&(n.filmGauge=t.filmGauge),t.filmOffset!==void 0&&(n.filmOffset=t.filmOffset),t.view!==void 0&&(n.view=Object.assign({},t.view));break;case"OrthographicCamera":n=new sr(t.left,t.right,t.top,t.bottom,t.near,t.far),t.zoom!==void 0&&(n.zoom=t.zoom),t.view!==void 0&&(n.view=Object.assign({},t.view));break;case"AmbientLight":n=new ir(t.color,t.intensity);break;case"DirectionalLight":n=new er(t.color,t.intensity);break;case"PointLight":n=new tr(t.color,t.intensity,t.distance,t.decay);break;case"RectAreaLight":n=new js(t.color,t.intensity,t.width,t.height);break;case"SpotLight":n=new $s(t.color,t.intensity,t.distance,t.angle,t.penumbra,t.decay);break;case"HemisphereLight":n=new Ks(t.color,t.groundColor,t.intensity);break;case"LightProbe":n=new Qs().fromJSON(t);break;case"SkinnedMesh":c=h(t.geometry),u=a(t.material),n=new Ws(c,u),t.bindMode!==void 0&&(n.bindMode=t.bindMode),t.bindMatrix!==void 0&&n.bindMatrix.fromArray(t.bindMatrix),t.skeleton!==void 0&&(n.skeleton=t.skeleton);break;case"Mesh":c=h(t.geometry),u=a(t.material),n=new Xi(c,u);break;case"InstancedMesh":{c=h(t.geometry),u=a(t.material);let m=t.count,p=t.instanceMatrix,y=t.instanceColor;n=new Zs(c,u,m),n.instanceMatrix=new lt(new Float32Array(p.array),16),y!==void 0&&(n.instanceColor=new lt(new Float32Array(y.array),y.itemSize));break}case"BatchedMesh":c=h(t.geometry),u=a(t.material),n=new Xs(t.maxGeometryCount,t.maxVertexCount,t.maxIndexCount,u),n.geometry=c,n.perObjectFrustumCulled=t.perObjectFrustumCulled,n.sortObjects=t.sortObjects,n._drawRanges=t.drawRanges,n._reservedRanges=t.reservedRanges,n._visibility=t.visibility,n._active=t.active,n._bounds=t.bounds.map(m=>{let p=new Ys;p.min.fromArray(m.boxMin),p.max.fromArray(m.boxMax);let y=new Hs;return y.radius=m.sphereRadius,y.center.fromArray(m.sphereCenter),{boxInitialized:m.boxInitialized,box:p,sphereInitialized:m.sphereInitialized,sphere:y}}),n._maxGeometryCount=t.maxGeometryCount,n._maxVertexCount=t.maxVertexCount,n._maxIndexCount=t.maxIndexCount,n._geometryInitialized=t.geometryInitialized,n._geometryCount=t.geometryCount,n._matricesTexture=l(t.matricesTexture.uuid);break;case"LOD":n=new qs;break;case"Line":n=new Gs(h(t.geometry),a(t.material));break;case"LineLoop":n=new Ds(h(t.geometry),a(t.material));break;case"LineSegments":n=new Ls(h(t.geometry),a(t.material));break;case"PointCloud":case"Points":n=new Js(h(t.geometry),a(t.material));break;case"Sprite":n=new Vs(a(t.material));break;case"Group":n=new Hi;break;case"Bone":n=new Is;break;default:n=new vi}if(n.uuid=t.uuid,t.name!==void 0&&(n.name=t.name),t.matrix!==void 0?(n.matrix.fromArray(t.matrix),t.matrixAutoUpdate!==void 0&&(n.matrixAutoUpdate=t.matrixAutoUpdate),n.matrixAutoUpdate&&(n.matrix.decompose(n.position,n.quaternion,n.scale),isNaN(n.quaternion.x)&&n.quaternion.set(0,0,0,1))):(t.position!==void 0&&n.position.fromArray(t.position),t.rotation!==void 0&&n.rotation.fromArray(t.rotation),t.quaternion!==void 0&&n.quaternion.fromArray(t.quaternion),t.scale!==void 0&&n.scale.fromArray(t.scale)),t.up!==void 0&&n.up.fromArray(t.up),t.castShadow!==void 0&&(n.castShadow=t.castShadow),t.receiveShadow!==void 0&&(n.receiveShadow=t.receiveShadow),t.shadow&&(t.shadow.bias!==void 0&&(n.shadow.bias=t.shadow.bias),t.shadow.normalBias!==void 0&&(n.normalBias=t.shadow.normalBias),t.shadow.radius!==void 0&&(n.radius=t.shadow.radius),t.shadow.mapSize!==void 0&&n.mapSize.fromArray(t.shadow.mapSize),t.shadow.camera!==void 0&&(n.camera=this.parseObject(t.shadow.camera))),t.visible!==void 0&&(n.visible=t.visible),t.frustumCulled!==void 0&&(n.frustumCulled=t.frustumCulled),t.renderOrder!==void 0&&(n.renderOrder=t.renderOrder),t.userData!==void 0&&(n.userData=t.userData),t.layers!==void 0&&(n.layers.mask=t.layers),t.children!==void 0){let m=t.children;for(let p=0;p<m.length;p++)n.add(this.parseObject(m[p],e,i,s,r))}if(t.animations!==void 0){let m=t.animations;for(let p=0;p<m.length;p++){let y=m[p];n.animations.push(r[y])}}if(t.type==="LOD"){t.autoUpdate!==void 0&&(n.autoUpdate=t.autoUpdate);let m=t.levels;for(let p=0;p<m.length;p++){let y=m[p],x=n.getObjectByProperty("uuid",y.object);x!==void 0&&n.addLevel(x,y.distance)}}else t.type==="QuarksPrefab"&&n.resolveReferences(n);return n}},qi=class o{static runOnAllParticleEmitters(t,e){t.traverse(i=>{i.type==="ParticleEmitter"&&e(i)}),t.type==="ParticleEmitter"&&e(t)}static addToBatchRenderer(t,e){o.runOnAllParticleEmitters(t,i=>{e.addSystem(i.system)})}static play(t){o.runOnAllParticleEmitters(t,e=>{e.system.play()})}static stop(t){o.runOnAllParticleEmitters(t,e=>{e.system.stop()})}static setAutoDestroy(t,e){o.runOnAllParticleEmitters(t,i=>{i.system.autoDestroy=e})}static endEmit(t){o.runOnAllParticleEmitters(t,e=>{e.system.endEmit()})}static restart(t){o.runOnAllParticleEmitters(t,e=>{e.system.restart()})}static pause(t){o.runOnAllParticleEmitters(t,e=>{e.system.pause()})}};xr();Vi(lr);console.log("%c Particle system powered by three.quarks. https://quarks.art/","font-size: 14px; font-weight: bold;");export{Ni as ApplyCollision,ve as ApplyForce,ni as ApplySequences,qt as AxisAngleGenerator,Cr as BatchedParticleRenderer,gi as BatchedRenderer,Fi as BehaviorFromJSON,bt as BehaviorTypes,Vt as Bezier,Me as ChangeEmitDirection,se as CircleEmitter,Oe as ColorBySpeed,Ee as ColorGeneratorFromJSON,le as ColorOverLife,Dt as ColorRange,ie as ConeEmitter,vt as ConstantColor,N as ConstantValue,Ei as DEG2RAD,re as DonutEmitter,zt as EmitSubParticleSystem,Ri as EmitterFromJSON,V as EmitterMode,Xt as EmitterShapes,jt as Euler,ii as EulerGenerator,de as ForceOverLife,pe as FrameOverLife,Yt as GeneratorFromJSON,Gt as Gradient,Se as GravityForce,ae as GridEmitter,oe as HemisphereEmitter,St as IntervalValue,Ne as LimitSpeedOverLife,Ot as MathUtils,nt as Matrix3,rt as Matrix4,Ue as MeshSurfaceEmitter,lr as MeshSurfaceEmitterPlugin,Ai as NodeParticle,ze as Noise,ye as OrbitOverLife,ci as ParticleEmitter,fi as ParticleMeshPhysicsMaterial,mi as ParticleMeshStandardMaterial,ui as ParticleSystem,te as PiecewiseBezier,ei as PiecewiseFunction,Ii as Plugins,ne as PointEmitter,Gi as QuarksLoader,xi as QuarksPrefab,qi as QuarksUtil,A as Quaternion,Pi as RAD2DEG,je as RandomColor,ti as RandomColorBetweenGradient,ee as RandomQuatGenerator,ri as RecordState,he as RectangleEmitter,_ as RenderMode,ue as Rotation3DOverLife,Ae as RotationBySpeed,Bi as RotationGeneratorFromJSON,ce as RotationOverLife,bs as SequencerFromJSON,Te as SizeBySpeed,me as SizeOverLife,fe as SpeedOverLife,_t as SphereEmitter,pi as SpriteBatch,ge as SpriteParticle,xt as SubParticleEmitMode,be as TextureSequencer,yi as TrailBatch,wt as TrailParticle,we as TurbulenceField,Be as VFXBatch,T as ValueGeneratorFromJSON,ht as Vector2,v as Vector3,Mt as Vector3Function,gs as Vector3GeneratorFromJSON,D as Vector4,Wt as WebGLCoordinateSystem,zi as WebGPUCoordinateSystem,xe as WidthOverLength,hs as ceilPowerOfTwo,st as clamp,Ki as damp,ns as degToRad,us as denormalize,Ci as euclideanModulo,ls as floorPowerOfTwo,Zi as generateUUID,Os as getPhysicsResolver,Tt as getValueFromEmitterMode,Qi as inverseLerp,as as isPowerOfTwo,Ui as lerp,Vi as loadPlugin,Wi as mapLinear,ds as normalize,$i as pingpong,os as radToDeg,is as randFloat,ss as randFloatSpread,es as randInt,xr as registerShaderChunks,rs as seededRandom,Tr as setPhysicsResolver,cs as setQuaternionFromProperEuler,ts as smootherstep,ji as smoothstep,Ar as unloadPlugin};
