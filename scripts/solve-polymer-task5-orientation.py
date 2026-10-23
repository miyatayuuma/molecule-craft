"""Owner: Task5 orientation feasibility ledger. Approximate CPU diagnosis only.
Requires numpy/scipy. No GPU, source coordinates, or acceptance thresholds change.
"""
import json, math, time
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.special import expit
from scipy.optimize import minimize

OUT=Path('test-results/pib-orientation-feasibility');OUT.mkdir(parents=True,exist_ok=True)
protocol=dict(kind='BOUNDED_GRAPH_SHADOW_MAXMIN_DIAGNOSIS_NOT_ACCEPTANCE',anchors=[0,17,30],seeds=2,
    seed_rule='retained reference; graph shadow normal cross(blocker-bond endpoint,bond axis) projected onto plane perpendicular to the worst endpoint-limited bond, two-sided sign nearest reference',
    budget_per_seed=800,iterations=80,area_quadrature=[40,9],atom_disk_samples=96,continuous_samples=97,
    optimization='SLSQP max-min normalized independent constraints; rotation-vector x/y components within +/-40deg and z within +/-90deg, not independent view/roll bounds; finite-difference Jacobian',
    adoption='not automatic; best minimum-margin evaluated point per seed (including finite-difference points), plus reference, in 3 fixed mesh arithmetic modes; min all constraints >=1; GPU remains authority',
    uncertainty='Smooth ideal spheres/cylinder side quadrature ignores cylinder caps, cylinder-cylinder shadows and mesh facets/pixels; negative self-ray discriminants clamp to zero; flat zero continuous runs can stop SLSQP without improvement; no feasibility or optimality proof',
    repeats=0)
(OUT/'solver-protocol.json').write_text(json.dumps(protocol,indent=2)+'\n')
f=json.load(open(OUT/'frozen-input.json'));I=f['initial'];A=I['layoutAtoms'];G=I['graph'];B=G['bonds'];
X=np.array([[a[k] for k in ('x','y','z')] for a in A]);R=np.array([.72*({'C':.46,'H':.32}[a['element']]) for a in A]);
D=np.linalg.norm(I['camera']['position']);W=I['canvas']['width'];H=I['canvas']['height'];F=H/(2*math.tan(math.radians(I['camera']['fov']/2)));S=I['fit']['safeRegion'];cx=(S['left']+S['right'])/2;cy=(S['top']+S['bottom'])/2
signs=np.array([[x,y,z] for x in (-1,1) for y in (-1,1) for z in (-1,1)])
refs={a:next(r for r in f['references'] if r['anchor']==a) for a in protocol['anchors']}
decomp={r['anchor']:r for r in json.load(open(OUT/'decomposition.json'))['rows']}
def target(anchor):return next(t['target'] for t in I['observation']['targets'] if t['target'].get('anchor')==anchor and t['target']['kind'].startswith('local:'))
def inputs(anchor):
 t=target(anchor);inds=set(t['atomIndices'])
 for b in B:
  if b['a'] in t['atomIndices'] or b['b'] in t['atomIndices']:inds.update([b['a'],b['b']])
 inds=sorted(inds);pivot=((X[inds]-R[inds,None]).min(0)+(X[inds]+R[inds,None]).max(0))*.5
 radius=np.max(np.linalg.norm(X-pivot,axis=1)+R);return t,inds,pivot,radius

def fit(anchor,q):
 t,inds,pivot,radius=inputs(anchor);rot=Rotation.from_quat(q);P=rot.apply(X-pivot);corners=P[inds,None,:]+signs[None,:,:]*R[inds,None,None]
 def measure(s):
  pts=s*corners;dep=D-pts[:,:,2]
  if dep.min()<=.2 or dep.max()>=500:return None
  tx=(cx-W/2)*D/F;ty=(H/2-cy)*D/F
  for _ in range(8):
   xx=W/2+F*(pts[:,:,0]+tx)/dep;yy=H/2-F*(pts[:,:,1]+ty)/dep
   dx=cx-(xx.min()+xx.max())/2;dy=cy-(yy.min()+yy.max())/2
   if math.hypot(dx,dy)<.05:break
   tx+=dx*D/F;ty-=dy*D/F
  xx=W/2+F*(pts[:,:,0]+tx)/dep;yy=H/2-F*(pts[:,:,1]+ty)/dep
  bounds=np.array([xx.min(),xx.max(),yy.min(),yy.max()]);fits=bounds[0]>=S['left'] and bounds[1]<=S['right'] and bounds[2]>=S['top'] and bounds[3]<=S['bottom'] and np.all(D-s*(P[:,2]+R)>.2) and np.all(D-s*(P[:,2]-R)<500)
  return fits,tx,ty,bounds
 lo=0.;hi=8.
 while hi<64 and (m:=measure(hi)) is not None and m[0]:hi*=2
 for _ in range(32):
  mid=(lo+hi)/2;m=measure(mid)
  if m is not None and m[0]:lo=mid
  else:hi=mid
 s=min(lo*.92,(D-.3)/(1.12*radius),(500-D-.01)/(1.12*radius));m=measure(s)
 if m is None or not m[0]:raise ValueError('fit unavailable')
 _,tx,ty,bounds=m;C=s*P+np.array([tx,ty,-D]);position=np.array([tx,ty,0])-s*rot.apply(pivot)
 return dict(pose=dict(quaternion=list(q),position=list(position),scale=s),C=C,r=s*R,qmin=np.min(F*s/(D-s*P[inds,2])),bounds=bounds)

def rays(screen):
 v=np.column_stack(((screen[:,0]-W/2)/F,(H/2-screen[:,1])/F,-np.ones(len(screen))));return v/np.linalg.norm(v,axis=1)[:,None]
def project(C):return np.column_stack((W/2+F*C[:,0]/-C[:,2],H/2-F*C[:,1]/-C[:,2]))
def clear(ray,near,C,r,exclude=None):
 b=ray@C.T;u=np.minimum(np.maximum(b,0),near[:,None]);d2=np.sum(C*C,axis=1)[None,:]-2*u*b+u*u
 gap=np.sqrt(np.maximum(d2,0))-r[None,:]
 if exclude is not None:gap[:,exclude]=100
 # 0.006 model units at s1, <=0.45 CSS px in this capture. Sensitivity only.
 return np.prod(expit(gap/.006),axis=1)
def cylinder(ray,P,v,L,r):
 oa=-P;dr=ray@v;da=oa@v;qa=1-dr*dr;qb=ray@oa-dr*da;qc=oa@oa-da*da-r*r;disc=qb*qb-qa*qc
 near=(-qb-np.sqrt(np.maximum(0,disc)))/np.maximum(qa,1e-15);h=da+near*dr
 weight=expit(h/.003)*expit((L-h)/.003);weight[(disc<0)|(near<=0)]=0
 return near,weight

def longest(prob,length):
 yes=prob>=.5;best=0.;step=length/(len(prob)-1);start=None
 for j,ok in enumerate(yes):
  if ok and start is None:
   start=0. if j==0 else (j-1+(.5-prob[j-1])/(prob[j]-prob[j-1]))*step
  if start is not None and (not ok or j==len(prob)-1):
   end=length if ok else (j-1+(prob[j-1]-.5)/(prob[j-1]-prob[j]))*step
   best=max(best,end-start);start=None
 return best

def evaluate(anchor,q):
 f=fit(anchor,q);C=f['C'];r=f['r'];s=f['pose']['scale'];t=target(anchor);margins=[];details=[]
 k=np.arange(96);rho=np.sqrt((k+.5)/96);ang=k*2.399963229728653
 for i in t['atomIndices']:
  p=project(C[[i]])[0];rp=F*r[i]/-C[i,2];screen=p+rp*np.column_stack((rho*np.cos(ang),rho*np.sin(ang)));ray=rays(screen);dot=ray@C[i];disc=dot*dot-C[i]@C[i]+r[i]*r[i];near=dot-np.sqrt(np.maximum(0,disc));vis=clear(ray,near,C,r,i);fraction=vis.mean();margins.extend([fraction/.60,2*rp/(5.5 if A[i]['element']=='H' else 9.5)]);details.append(dict(kind='atom',index=i,fraction=float(fraction)))
 for j in t['bondIndices']:
  b=B[j];v=C[b['b']]-C[b['a']];v/=np.linalg.norm(v);P=C[b['a']]+v*(r[b['a']]-.01*s);Z=C[b['b']]-v*(r[b['b']]-.01*s);L=np.linalg.norm(Z-P);rc=.05*s;ps=project(np.array([P,Z]));delta=ps[1]-ps[0];length=np.linalg.norm(delta);normal=np.array([-delta[1],delta[0]])/length;width=2*F*rc/(-(P[2]+Z[2])/2)
  tt=(np.arange(40)+.5)/40;kk=((np.arange(9)+.5)/9*2-1);screen=(ps[0]+tt[:,None]*delta)[:,None,:]+kk[None,:,None]*width/2*normal;ray=rays(screen.reshape(-1,2));near,weight=cylinder(ray,P,v,L,rc);prob=weight*clear(ray,near,C,r);area_fraction=prob.mean();
  tt=np.linspace(0,1,97);screen=(ps[0]+tt[:,None]*delta)[:,None,:]+np.array([-.5,0,.5])[None,:,None]*normal;ray=rays(screen.reshape(-1,2));near,weight=cylinder(ray,P,v,L,rc);prob=weight*clear(ray,near,C,r);prob=1-np.prod(1-prob.reshape(97,3),axis=1);continuous=longest(prob,length)
  margins.extend([area_fraction/.50,continuous/7.75,length/7.75,width/1.25]);details.append(dict(kind='bond',index=j,areaMargin=float(area_fraction/.5),continuous=float(continuous),length=float(length),width=float(width)))
 margins.append(f['qmin']/20)
 return np.array(margins),details,f

def graph_seed(anchor):
 row=decomp[anchor];ref=refs[anchor]['pose']['quaternion'];q=Rotation.from_quat(ref);back=q.inv().apply([0,0,1]);
 losses=[(sum(b['lossOwners'].values()),b) for b in row['bonds']];_,bad=max(losses,key=lambda x:(x[0],-x[1]['index']))
 if not bad['lossOwners']:return ref,dict(reason='no nonendpoint occluder; retained seed is only a feasibility control')
 owner=max(bad['lossOwners'],key=bad['lossOwners'].get)
 if not owner.startswith('atom:'):return ref,dict(reason='no atom shadow owner')
 blocker=int(owner.split(':')[1]);b=B[bad['index']];v=X[b['b']]-X[b['a']];w=X[blocker]-X[b['a']];n=np.cross(w,v)
 endpoint=min(row['bonds'],key=lambda b:b['components']['endpoints']['continuous']/7.75);be=B[endpoint['index']];ve=X[be['b']]-X[be['a']];ve/=np.linalg.norm(ve);n-=ve*(n@ve);n/=np.linalg.norm(n)
 if n@back<0:n=-n
 # Minimal rotation from the reference normal, preserving its initial roll.
 cross=np.cross(n,back);sine=np.linalg.norm(cross);cos=float(n@back);delta=Rotation.from_rotvec(cross/max(sine,1e-15)*math.atan2(sine,cos));seed=(q*delta).as_quat()
 return seed,dict(blocker=blocker,shadowBond=bad['index'],endpointBond=endpoint['index'],normal=n.tolist(),condition='normal perpendicular to endpoint axis; maximize scalar-triple-product separation numerator in that plane, not the projected distance (its denominator also varies)')

rows=[]
for anchor in protocol['anchors']:
 ref=refs[anchor]['pose'];check=fit(anchor,ref['quaternion']);assert np.max(np.abs(np.array(check['pose']['position'])-ref['position']))<1e-8;assert abs(check['pose']['scale']-ref['scale'])<1e-8
 seed,condition=graph_seed(anchor)
 for seed_index,start in enumerate([ref['quaternion'],seed]):
  # Controls at 0/17 need no redundant identical second optimization.
  if seed_index==1 and np.max(np.abs(np.array(start)-np.array(ref['quaternion'])))<1e-10:
   rows.append(dict(anchor=anchor,seed=seed_index,status='IDENTICAL_GRAPH_SEED_NOT_RUN',condition=condition));continue
  base=Rotation.from_quat(start);calls=0;cache={};history=[]
  def values(x):
   global calls
   key=tuple(x[:3])
   if key not in cache:
    if calls>=800:raise RuntimeError('EVALUATION_BUDGET')
    calls+=1;q=(Rotation.from_rotvec(x[:3])*base).as_quat();m,d,fit_result=evaluate(anchor,q);cache[key]=(m,d,fit_result);history.append(dict(call=calls,x=list(x[:3]),minimum=float(m.min()),pose=fit_result['pose'],details=d))
   return cache[key][0]
  x0=np.zeros(4);x0[3]=min(values(x0))*.98
  status='COMPLETE'
  try:
   result=minimize(lambda x:-x[3],x0,method='SLSQP',bounds=[(-math.radians(40),math.radians(40)),(-math.radians(40),math.radians(40)),(-math.pi/2,math.pi/2),(0,2)],constraints=[dict(type='ineq',fun=lambda x:values(x)-x[3])],options=dict(maxiter=80,ftol=1e-6,eps=1e-4))
   message=result.message
  except RuntimeError as e:status=str(e);message=str(e)
  best=max(history,key=lambda v:v['minimum']);rows.append(dict(anchor=anchor,seed=seed_index,status=status,message=message,calls=calls,condition=condition,best=best,history=history));print(json.dumps(dict(anchor=anchor,seed=seed_index,calls=calls,status=status,best=best['minimum'],constraints=sorted(best['details'],key=lambda v:min(v.get('areaMargin',2),v.get('continuous',16)/7.75) if v['kind']=='bond' else v['fraction']/.6)[:4])),flush=True)
  (OUT/'solver.json').write_text(json.dumps(dict(protocol=protocol,rows=rows),indent=2)+'\n')
