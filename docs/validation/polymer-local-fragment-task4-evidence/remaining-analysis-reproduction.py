import json,pathlib,gzip,hashlib,collections,os
out=pathlib.Path(os.environ.get('TASK4_ANALYSIS_OUTPUT','/tmp/task4-reproduced-analysis'));out.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,data,compressed=False):
 b=(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode();(out/name).write_bytes(gzip.compress(b,mtime=0)if compressed else b)
logs=[];profiles=[]
for run in [39351928250,39352734608,39353100047,39353360567]:
 s=json.load(open(f'/tmp/task4-log-{run}.json'));logs.append(s)
 for line in s['rawText'].splitlines():
  mark='POLYMER_PROFILE_TRIAL '
  if mark in line:profiles.append({'runId':run,'trial':json.loads(line.split(mark,1)[1])})
save('remaining-full-job-logs.json.gz',logs,True);save('remaining-all-diagnostic-profile-trials.json',{'method':'All retained diagnostic profile rows, separated by run; never pooled or used for acceptance.','rows':profiles})
clipped=[];observations=[];analysis=[];sources=[]
for label,run,base in [('baseline',39352734608,'/tmp/task4-wait-39352734608/baseline'),('candidate',39353100047,'/tmp/task4-candidate-39353100047/candidate')]:
 base=pathlib.Path(base)
 for i in range(5):
  tp=base/f'boundary-trace-normal-{i}.json';op=base/f'boundary-observation-normal-{i}.json';raw=tp.read_bytes();t=json.loads(raw);o=json.loads(op.read_bytes());e=t['traceEvents'];mark=next(x for x in e if x['name']=='task4:molecule-craft:reaction-lab-polymer-sample');origin=mark['ts'];pid=mark['pid'];tid=mark['tid'];m=o['measurement'];f=m['frameIntervalsMs'];pos=f['firstFrameOffsetMs'];gaps=[]
  for v in f['values']:
   if v>25:
    hits=[x for x in e if x.get('ph')=='X' and x.get('ts',0)<origin+(pos+v)*1000 and x.get('ts',0)+x.get('dur',0)>origin+pos*1000]
    def span(x):return{'name':x['name'],'pid':x['pid'],'tid':x['tid'],'startRelativeMs':(x['ts']-origin)/1000,'wallMs':x.get('dur',0)/1000,'threadCpuMs':x['tdur']/1000 if 'tdur'in x else None}
    swaps=sorted([x for x in hits if x['name']=='SkiaOutputSurfaceImplOnGpu::SwapBuffers'],key=lambda x:x.get('dur',0),reverse=True)
    tasks=sorted([x for x in hits if x['pid']==pid and x['tid']==tid and x['name']=='ThreadControllerImpl::RunTask'],key=lambda x:x.get('dur',0),reverse=True)
    gaps.append({'rafStartRelativeMs':pos,'rafEndRelativeMs':pos+v,'durationMs':v,'overlappingGpuSwapBuffers':[span(x)for x in swaps],'largestOverlappingMainTask':span(tasks[0])if tasks else None})
   pos+=v
  started=next(x['start']for x in o['rows']if x['name']=='molecule-craft:reaction-lab-polymer-sample');early=[x for x in o['rows']if started<=x['start']<=started+150]
  analysis.append({'label':label,'runId':run,'sourceSha':o['sourceSha'],'trialIndex':i,'warmup':i==0,'rendererPid':pid,'rendererTid':tid,'mainRunTaskCount':sum(1 for x in e if x['pid']==pid and x['tid']==tid and 'RunTask'in x['name']),'earlySnapshotMaxMs':max([x['durationMs']for x in early if x['name']=='probe.snapshot']or[0]),'earlySizeAndResizeSpans':[x for x in early if x['name']in['resize','renderer.setSize','canvas.width','canvas.height']],'longFrames':gaps})
  start=origin-100000;end=origin+max(m['targetDurationMs']+150,f['lastFrameOffsetMs']+150,m['completionElapsedMs']+150)*1000
  chosen=[x for x in e if x.get('ph')=='M' or x.get('ts',0)<=end and x.get('ts',0)+x.get('dur',0)>=start]
  clip={'label':label,'runId':run,'trialIndex':i,'fullTraceSha256':sha(raw),'fullTraceBytes':len(raw),'fullEventCount':len(e),'retainedEventCount':len(chosen),'windowTraceMicroseconds':{'start':start,'end':end},'rule':'All metadata, plus every timestamped event intersecting [sample registration minus100ms, max(target,completion,lastFrame)+150ms]. All five normal trials are retained including warm-up; no trial/long-frame selection. Full originals remain in the checksum-verified artifact.','availableCategories':t.get('availableCategories'),'enabledCategories':t.get('enabledCategories'),'traceEvents':chosen}
  clipped.append(clip);observations.append({'label':label,'runId':run,'observation':o});sources.append({k:clip[k]for k in ['label','runId','trialIndex','fullTraceSha256','fullTraceBytes','fullEventCount','retainedEventCount','windowTraceMicroseconds']})
save('remaining-normal-completion-traces.json.gz',clipped,True);save('remaining-full-normal-observations.json.gz',observations,True)
save('remaining-wait-analysis.json',{'method':'Each retained normal trial. RAF spans reconstructed from rounded first offset plus all raw rounded interval values; no Node/browser clock subtraction. GPU spans and main-thread wall/CPU are trace values relative to the same sample user-timing marker. Overlap establishes an observed boundary, not a driver or OS-scheduler root cause; original uninstrumented five intervals have no trace.','rows':analysis,'fullTraceSources':sources})
save('remaining-field-launch-observation.json',json.load(open('/tmp/task4-boundary-39351928250/field/field-launch-diagnostic.json')))
manifest={'files':[],'rawLogHashes':[{'runId':s['runId'],'utf8Bytes':len(s['rawText'].encode()),'sha256':sha(s['rawText'].encode())}for s in logs],'diagnosticProfileRows':len(profiles),'profileRowsByRun':dict(collections.Counter(str(s['runId'])for s in profiles)),'artifacts':[{'runId':39351928250,'artifactId':12233771381,'verifiedZipSha256':'94dba5f504adb2247a272a05f94e0be33cb383c66ac6ae68a82b5cd57bb871af'},{'runId':39352734608,'artifactId':12233613114,'verifiedZipSha256':'047027045191d6b8eb3d5075123a498107e10b9cea42ae778454373f02fcc232'},{'runId':39353100047,'artifactId':12233971637,'verifiedZipSha256':'2ffa239b252c6ac738cf951d237b9ac0045449ddbcde18eeff3b0fabe9b5feeb'}]}
for p in sorted(out.iterdir()):
 if p.name=='remaining-evidence-manifest.json':continue
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
save('remaining-evidence-manifest.json',manifest)
print(json.dumps({'files':manifest['files'],'rows':manifest['profileRowsByRun'],'candidateMeasuredGaps':[len(r['longFrames'])for r in analysis if r['label']=='candidate'and not r['warmup']]}))
