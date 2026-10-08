import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {extname,resolve,sep,posix} from 'node:path';

const DEFAULT_ROOT=new URL('../',import.meta.url);
const COPY_DIRECTORY=/^(?:legacy|archive|old|backup|bak)$/i;
const CODE_LIKE=new Set(['.js','.mjs','.cjs','.html','.css','.json']);
const SIZE_WARNINGS=new Map([
  ['README.md',12_000],
  ['AGENTS.md',8_000],
]);
const TRANSIENT_DOCUMENT=/(^|\/)(?:WORK_PROGRESS\.md|handoffs?\/.*|[^/]*handoff[^/]*\.md)$/i;
const OWNERSHIP_TEXT=/\.(?:md|mjs|js|html|ya?ml|json|css|webmanifest)$/i;

async function walk(root,directory='',files=[]){
  for(const item of await readdir(new URL(directory||'./',root),{withFileTypes:true})){
    if(item.name==='.git'||item.name==='node_modules')continue;
    const relative=`${directory}${item.name}`;
    if(item.isDirectory())await walk(root,`${relative}/`,files);
    else files.push(relative);
  }
  return files;
}

function rootURL(value){
  if(value instanceof URL)return value;
  return pathToFileURL(resolve(value)+sep);
}

function withoutComments(source){
  let result='',state='code';
  for(let i=0;i<source.length;i++){
    const char=source[i],next=source[i+1];
    if(state==='line'){
      if(char==='\n'){state='code';result+='\n';}else result+=' ';
      continue;
    }
    if(state==='block'){
      if(char==='*'&&next==='/'){result+='  ';i++;state='code';}
      else result+=char==='\n'?'\n':' ';
      continue;
    }
    if(state==='single'||state==='double'||state==='template'){
      result+=char;
      if(char==='\\'&&i+1<source.length){result+=source[++i];continue;}
      if((state==='single'&&char==="'")||(state==='double'&&char==='"')||(state==='template'&&char==='`'))state='code';
      continue;
    }
    if(char==='/'&&next==='/'){result+='  ';i++;state='line';continue;}
    if(char==='/'&&next==='*'){result+='  ';i++;state='block';continue;}
    if(char==="'")state='single';else if(char==='"')state='double';else if(char==='`')state='template';
    result+=char;
  }
  return result;
}

function moduleSpecifiers(source){
  const text=withoutComments(source),specifiers=[];
  const patterns=[
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\b(?:new\s+)?(?:Worker|SharedWorker)\s*\(\s*(?:new\s+URL\s*\(\s*)?['"]([^'"]+)['"]/g,
  ];
  for(const pattern of patterns)for(const match of text.matchAll(pattern))specifiers.push(match[1]);
  return specifiers;
}

function resolveImport(importer,specifier,sourceSet=null){
  const clean=specifier.split(/[?#]/,1)[0];
  if(!clean||(!clean.startsWith('.')&&!clean.startsWith('/')))return null;
  let path=clean.startsWith('/')?posix.normalize(clean.slice(1)):posix.normalize(posix.join(posix.dirname(importer),clean));
  if(sourceSet&&!sourceSet.has(path)&&!extname(path)&&sourceSet.has(`${path}.js`))path=`${path}.js`;
  return path;
}

function moduleRoots(index){
  const roots=[];
  for(const match of index.matchAll(/<script\b([^>]*)>/gi)){
    const attrs=match[1];
    if(!/\btype\s*=\s*['"]module['"]/i.test(attrs))continue;
    const src=attrs.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    if(src)roots.push(resolveImport('index.html',src));
  }
  return roots.filter(Boolean);
}

async function inspectProductionModules(root,files,index,errors){
  const sourceFiles=files.filter(path=>path.startsWith('src/')&&path.endsWith('.js'));
  const sourceSet=new Set(sourceFiles),roots=moduleRoots(index).filter(path=>path.startsWith('src/'));
  const dependencies=new Map();
  for(const path of sourceFiles){
    const text=await readFile(new URL(path,root),'utf8'),deps=[];
    for(const specifier of moduleSpecifiers(text)){
      const dependency=resolveImport(path,specifier,sourceSet);
      if(!dependency||!dependency.startsWith('src/'))continue;
      if(!sourceSet.has(dependency))errors.push(`Missing production module dependency: ${path} -> ${specifier}`);
      else deps.push(dependency);
    }
    dependencies.set(path,deps);
  }
  for(const entry of roots)if(!sourceSet.has(entry))errors.push(`Missing production module entrypoint: ${entry}`);
  const reachable=new Set(),queue=roots.filter(path=>sourceSet.has(path));
  while(queue.length){
    const path=queue.shift();
    if(reachable.has(path))continue;
    reachable.add(path);
    for(const dependency of dependencies.get(path)??[])if(!reachable.has(dependency))queue.push(dependency);
  }
  const unreachable=sourceFiles.filter(path=>!reachable.has(path));
  if(unreachable.length)errors.push(`Unreachable production module(s): ${unreachable.join(', ')}. Import them from a production entry/worker path or remove them from src/.`);
  return {sourceFiles,reachable};
}

function isOwnershipCandidate(path){
  return OWNERSHIP_TEXT.test(path)&&(path==='README.md'||path==='AGENTS.md'||path.startsWith('docs/')||path.startsWith('tests/')||path.startsWith('.github/workflows/')||path.startsWith('scripts/')||!path.includes('/'));
}

async function inspectScriptOwnership(root,files,warnings){
  const scripts=files.filter(path=>/^scripts\/[^/]+\.mjs$/.test(path));
  const candidates=files.filter(isOwnershipCandidate),textByPath=new Map();
  for(const path of candidates)textByPath.set(path,await readFile(new URL(path,root),'utf8'));
  for(const script of scripts){
    let owned=false;
    for(const [owner,text] of textByPath){
      if(owner===script)continue;
      if(text.includes(script)){owned=true;break;}
      if((owner.endsWith('.js')||owner.endsWith('.mjs'))&&moduleSpecifiers(text).some(specifier=>resolveImport(owner,specifier)===script)){owned=true;break;}
    }
    if(!owned)warnings.push(`Unowned tooling script: ${script}. Reference it from README/docs, a test/workflow, another script, or its generated artifact.`);
  }
}

export async function inspectRepository(value=DEFAULT_ROOT){
  const root=rootURL(value),errors=[],warnings=[],files=await walk(root);
  const topLevelSource=files.filter(path=>path.startsWith('src/')&&path.split('/').length===2);
  const versionedEntries=topLevelSource.filter(path=>/^src\/app-v.*\.js$/i.test(path));
  if(versionedEntries.length)errors.push(`Versioned app entrypoints are forbidden: ${versionedEntries.join(', ')}`);
  if(!topLevelSource.includes('src/app.js'))errors.push('Missing stable application entrypoint: src/app.js');

  const index=await readFile(new URL('index.html',root),'utf8');
  if(!/<script type="module" src="\.\/src\/app\.js(?:\?[^\"]*)?"><\/script>/.test(index))errors.push('index.html must load ./src/app.js');
  if(/\.\/src\/app-v[^"'?]*\.js/i.test(index))errors.push('index.html still references a versioned app entrypoint');

  const copiedCode=files.filter(path=>{
    const segments=path.split('/').slice(0,-1);
    return CODE_LIKE.has(extname(path))&&segments.some(segment=>COPY_DIRECTORY.test(segment));
  });
  if(copiedCode.length)errors.push(`Historical-code directory detected; use Git history instead: ${copiedCode.join(', ')}`);

  const transientDocs=files.filter(path=>TRANSIENT_DOCUMENT.test(path));
  if(transientDocs.length)errors.push(`Transient handoff/progress document detected; keep completed work in Git/Issue/PR history: ${transientDocs.join(', ')}`);

  for(const [path,limit] of SIZE_WARNINGS){
    const text=await readFile(new URL(path,root),'utf8'),bytes=Buffer.byteLength(text);
    if(bytes>limit)warnings.push(`${path} is ${bytes} bytes; keep it below ${limit} bytes or split current detail into focused docs`);
  }

  const production=await inspectProductionModules(root,files,index,errors);
  await inspectScriptOwnership(root,files,warnings);

  const precache=await readFile(new URL('precache-manifest.js',root),'utf8');
  if(!precache.startsWith('// Generated by scripts/build-precache.mjs; do not edit.'))errors.push('precache-manifest.js is missing its generated-file marker');

  return {errors,warnings,fileCount:files.length,productionModuleCount:production.sourceFiles.length,reachableProductionModuleCount:production.reachable.size};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await inspectRepository();
  for(const warning of result.warnings)console.warn(`WARN: ${warning}`);
  for(const error of result.errors)console.error(`ERROR: ${error}`);
  if(result.errors.length)process.exitCode=1;
  else console.log(`Repository hygiene passed: ${result.fileCount} files, ${result.productionModuleCount} production modules reachable, ${result.warnings.length} warning(s)`);
}
