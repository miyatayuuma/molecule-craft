# Task③ visual evidence, measurements and validation manifest

## 1. Authority and evidence kinds

Source main `905ba4f1fb4a0e6d63e658a9f178ac29ad8beb49`、調査2026-10-19 JST。Task③ branch `docs/polymer-local-fragment-task3`。正本は[visual spec](polymer-local-fragment-task3-visual-spec.md)と[25-route matrix](polymer-local-fragment-task3-visual-matrix.md)。runtime/chemistry/data/save/PWA/generated assets/performance thresholds/workflowsは変更しない。evidence画像/JSONはdocs配下の設計証拠でありゲームの生成assetではない。

| Kind | 今回の実態 / 使用限界 |
|---|---|
| BASELINE_CURRENT | exact mainのGitHub Actions実ブラウザPNG9枚を取得・hash照合・一部目視。Task③の新しいbrowser撮影ではない |
| TARGET_REFERENCE | 新しい見本画像は作っていない。targetはspecのtokens/fit/state、別実装画面の写真として提示しない |
| ANALYTICAL_PROJECTION_NOT_SCREENSHOT | 実Coreとsource preview/layoutをNodeで実行した全25×3viewportの計算。将来DOM予算上の寸法の実行可能性検算。raster/遮蔽/素材/操作の証明ではない |
| FUTURE_ACCEPTANCE | spec A01–A15とmatrix全25/C01–C09/S10–S16の同条件画像/sidecar。現時点NOT_CAPTURED |
| NOT_CAPTURED | 360×780、390×844の新target、1280×800、PAN/NBR/PTFE等の今回未取得画像、全新比較UI、DPR2/実機/全reduced条件。⑤/⑥が取得 |

## 2. Retrieved real-browser baseline

main push [run 39169699189](https://github.com/miyatayuuma/molecule-craft/actions/runs/39169699189)、attempt1、[artifact 12152316641](https://github.com/miyatayuuma/molecule-craft/actions/runs/39169699189/artifacts/12152316641)。downloaded ZIP SHA256 `de5f312281b99db06be5287617605600b3ac7028ece38be3657ba40d9267119f` はGitHub artifact digestと一致。元member prefix `molecule-craft/molecule-craft/test-results/reaction-lab-polymer-simplification/`。raw [browser-390.json](polymer-local-fragment-task3-evidence/browser-390.json) と [performance-390.json](polymer-local-fragment-task3-evidence/performance-390.json)も変更せず保存。後者は過去runの実結果で、Task③の新性能測定に数えない。

Chrome/155.0.8059.39 revision `@3ff7ac5a9224be9156d7f8703a06e22890aafd34`、Linux GitHub runner、DPR1、headless/SwiftShader（flags全文は[baseline-manifest.json](polymer-local-fragment-task3-evidence/baseline-manifest.json)）。画像寸法は実PNGで照合。mobile390×844、desktop1280×900で**1280×800ではない**。normal650ms完成後のrepresentative-ready、Collectionを閉じてLabへ戻った画面。desktop PEはobservation-initial。camera FOV42/near.1/far500はsource constants、mobile fit quaternion/scale/positionはraw JSONにある。ただし撮影時exact camera matrix、sampleId、actualcanvas DOMRect、atom pixel mask、個別capture時刻は未保存=UNKNOWN。fit metadataを撮影時poseの完全証明として使わない。

| file / case | viewport CSS | kind/state | 画面確認と限界 |
|---|---|---|---|
| [observation-initial-1280.png](polymer-local-fragment-task3-evidence/observation-initial-1280.png) / C01 | 1280×900 | BASELINE_CURRENT / observation-initial | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-nylon-6-6-390.png](polymer-local-fragment-task3-evidence/representative-nylon-6-6-390.png) / C05 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-phenol-formaldehyde-resin-390.png](polymer-local-fragment-task3-evidence/representative-phenol-formaldehyde-resin-390.png) / C09 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-polyethylene-390.png](polymer-local-fragment-task3-evidence/representative-polyethylene-390.png) / C01 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-polyethylene-oxide-390.png](polymer-local-fragment-task3-evidence/representative-polyethylene-oxide-390.png) / C06 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-polyethylene-terephthalate-390.png](polymer-local-fragment-task3-evidence/representative-polyethylene-terephthalate-390.png) / C04 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-polypropylene-390.png](polymer-local-fragment-task3-evidence/representative-polypropylene-390.png) / C02 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-polystyrene-390.png](polymer-local-fragment-task3-evidence/representative-polystyrene-390.png) / C03 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |
| [representative-styrene-butadiene-copolymer-390.png](polymer-local-fragment-task3-evidence/representative-styrene-butadiene-copolymer-390.png) / C08 | 390×844 | BASELINE_CURRENT / representative-ready-after-Collection-return | 全atom/raster対応は未採点、target PASSでない。SHA256はsidecar |

C07 PANはNOT_CAPTURED。L1はsource `updatePolymerBondVisuals`で確認した既知欠陥であり、PAN画像を撮影したとはしない。PE/PS/nylon/PFの4枚は目視し、球の陰影、全体がcanvas内に見えること、模型周囲の大きな空白、混雑を限定確認。全25/全視点の外観監査をしたとの主張ではない。

### Pixel measurement of current appearance

PNGをPillow RGBで読み、ROI `x=[78,310), y=[300,650)`内の `max(R,G,B)>=65` 画素のbboxを取得（右下exclusive）。このROI内で模型以外のequipment文字を含まないPE/PP/PS/PET/nylon/PEO/PFだけを対象。これはbright-pixel envelopeで、全原子の投影範囲・不可視H・bond本数を数えたものではない。SBRはROI外にも模型があり、この手法を適用しない。原画像を変更していない。

| route | bright bbox (CSS px at DPR1) | width×height CSS px |
|---|---|---|
| PE | (144,441)–(251,552) | 107×111 |
| PP | (135,439)–(254,545) | 119×106 |
| PS | (130,445)–(255,555) | 125×110 |
| PET | (151,425)–(244,550) | 93×125 |
| Nylon-6,6 | (145,426)–(244,536) | 99×110 |
| PEO | (132,436)–(247,545) | 115×109 |
| PF | (143,429)–(245,553) | 102×124 |

raw ready metadataのmobile safe rectangleは全代表でL69.92/T64/R298.08/B547（228.16×483 CSS px）。これはfit計算時のcanvas座標で、PNG原点や撮影時DOM寸法とは別。上のPNG絶対座標bboxを直接この矩形へ差分比較して合否にしない。模型が小さく表示される現状を数値と画像で確認し、targetをtight fit/占有率.70–.94と局所到達へ変える根拠とした。現在の全edge識別FAILをこのbboxだけから断定しない。

## 3. Numerical design derivation and full-25 analytical check

[analytical-projections.json](polymer-local-fragment-task3-evidence/analytical-projections.json)は25実Core graph、origin、route evidence、final target selectors、source pose/layout診断、各3viewportでの48姿勢candidate search結果。source種別を全25から抽出、実representativeSequenceをu0…、generation1で消費。preview190step/layout96iteration、camera d15/FOV42、sphere radiusは現source定数。各sphereのcamera-axis外接cube8頂点を投影し、S中心へ8回以内translation補正、scale32回binary search、.92marginで検算した。

将来DOM budget: 360×780→canvas338×430、390×844→368×494、1280×800→856×420。保守safe rectangle `[12,W−78]×[74,H−82]` はLIGHT/HEAT/pH/ヒントの現寸法＋余白に由来し、仕様の実DOM最大空矩形より狭い場合を検算。将来画面の実寸を測ったという意味ではない。fixtureの元XYZはmean中心で生成され、bound中心補正をgroup translationで行うため、中心の取り方でgraph距離は変化しない。各sphere cubeのconvex hullはendpoint sphere半径より小さい本仕様のlane envelope（最大offset+radius=.198world）も包み、fitはstickを除外して小さく見積もらない。

実行結果: 25/25 layout diagnostics accepted、75/75 analytical fit=true。占有率 **.878140–.928140**、最大bound中心誤差 **.205458 CSS px**。最小H投影直径 **11.110263 CSS px**（nylon360条件、HなしrouteはNA）、全75で最小局所倍率q **24.110814 CSS px/world**。この余裕は現source fixtureで寸法が成立する証拠で、camera d全域・将来geometryの遮蔽・完成DOM・GPU/児童を認証しない。

半径は現`.72×ELEMENTS.radius`を保持することで化学graphへ影響せず比較可能。radius/光源/materialの新規「最適化」を未比較で採用しない。single .050/multiple .038とoffset .160刻みはq20で幅2.00/1.52pxと背景gap1.68pxを生む。current single .038は同倍率で1.52px、.050は細線余裕を追加。全75のq最小24.11を用いた同寸法なら幅2.411/1.832px、gap2.025px。これは投影面に平行なlaneの計算で、end-onや遮蔽にはA04/A07の実PNG検査が別途必要。

overviewのH4px/重原子6px、local6px/10pxは、現画像で数pxの球が存在する条件より粗くしない下限と、三重結合幅7.92px/q20を受け止める球サイズに整合する設計予算。現fixture投影はこれを十分上回る。知覚/児童の実証値と呼ばない。specはcoverage/色以外の手掛かり/実操作を別条件として要求する。

全75の値はJSONの`measurements`、graph対象は`selector`。source-site由来のbackbone（chainのみ）、ring全edge、carbonyl、ester/amide/ether、acidOH、PF bridge/hydroxymethylも機械的に保持する。estercarbonylのC–O候補とamide C–Nは実結合次数/隣接元素から選び、推定反応機構とはしない。before graphのtargetは実source snapshot/tuple、byproductはevidence partitionで別に解決する。

再現: [projection reproduction](polymer-local-fragment-task3-evidence/reproduce-projections.md)のJSを一時scriptへ取り出し実行。graph digests/targets/座標・寸法をsource SHAに対して比較する。temporary scriptはcommitしない。

## 4. Coverage and future capture protocol

C01–C09のうち8caseのmobile current PNG＋C01desktopを取得。baselineの未知poseは埋めず、Task⑤はspecのfull sidecar条件で再撮影する。新geometryの比較は同fixture graph/origin保持、同viewport/実canvas/S/DPR/browser/motion/state/camera conventionで行う。coordinates変更後に旧PNGとpixel一致を求めず、A01–A15とtarget集合coverageを同じ尺度で評価する。

Future evidence: 全25でoverview/reset、local40view coverage witness、V1/V2/V3/V4/V5/V6/V7/V8該当state。C/S stressでDPR2。before/after/byproductは別state/identity、PF conceptも別identity。全representative9について質問/非誘導条件はTask②と同じ。Task③に児童観察はない。

新しいlocal Chromiumは環境に存在せず、標準Playwright browser取得は有効ZIPを得られず失敗した。権限や実画面を推測して代用せず、exact-main CI実画像を限定利用した。今回ローカル実ブラウザ操作、target renderer、360×780/1280×800/DPR2/reduced新画面はNOT_RUN。図や静的解析を実画面撮影と称しない。

## 5. Existing CI failure and applicability

開始main run39169699189は**FAIL**。finite job117799999492のdesktop pointer suiteがPF completionでframeCount1/validIntervals0、elapsed662.2ms/target650msでassertion失敗。Stage B job117799999673もcandidate trial4 P95=10.0ms / pooled8.4msが8.333333333333334ms absoluteを超えてFAIL（relative checksはPASS）。baseline pooled10.8msも高いが、これを理由にcandidate FAILを消さない。先行#345の過去FAILとも別run。

Task③開始前の同じruntime sourceですでに発生しており、文書差分の新規FAILではないことを確認。原因の深掘り/性能修復は今回行わない。Task③ PRのCIは別に実結果を記録し、新規/未知FAILは自動免除しない。main.protected=false、open PRは#345/#189、Task③重複PRなしをpreflightで確認。既存workflow/required gateを変更しない。設計受入とproduction性能受入を分ける。

## 6. Documentation validation procedure

次のJS blockをrepository rootで `node --input-type=module` のstdinへ渡す。実Core graphはprojection再現＋既存fixture testで照合する。この文書検査は独立reviewや実視覚受入の代替ではない。

```js
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
const dir='docs/validation/', prefix=dir+'polymer-local-fragment-task3-';
const [spec,matrix,evidence,edu,authority,fixture,manifest]=await Promise.all([
 prefix+'visual-spec.md',prefix+'visual-matrix.md',prefix+'visual-evidence.md',dir+'polymer-local-fragment-task2-education-matrix.md',
 'data/polymerization-routes.json',prefix+'evidence/analytical-projections.json',prefix+'evidence/baseline-manifest.json'].map(p=>readFile(p,'utf8')));
const routes=JSON.parse(authority).routes,f=JSON.parse(fixture),m=JSON.parse(manifest);
const rows=matrix.split('\n').filter(l=>l.startsWith('| `')).map(l=>l.split('|').slice(1,-1).map(c=>c.trim().replaceAll('`','')));
const old=edu.split('\n').filter(l=>l.startsWith('| `')).map(l=>l.split('|').slice(1,-1).map(c=>c.trim().replaceAll('`','')));
const details=[...edu.matchAll(/^### (\d+)\. `([^`]+)`\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
assert.equal(rows.length,25);assert.equal(f.rows.length,25);
for(const col of [0,1])assert.equal(new Set(rows.map(r=>r[col])).size,25);
assert.deepEqual(rows.map(r=>r[1]).sort(),routes.map(r=>r.routeId).sort());
const allV=new Set();
for(const route of routes){
 const row=rows.find(r=>r[0]===route.polymerId),prev=old.find(r=>r[0]===route.polymerId),fr=f.rows.find(r=>r.polymerId===route.polymerId);
 assert.equal(row[1],route.routeId);assert.equal(row[2],prev[2]+' / '+prev[3]);assert.equal(fr.routeId,route.routeId);
 const vs=details.find(s=>s[2]===route.polymerId)[3].match(/- Task③ 視覚的強調: (.*?)。/)[1].split(' ');
 for(const v of vs){assert.ok(row[3].split(' ').includes(v),route.polymerId+': '+v);allV.add(v)}
 assert.ok(row[3].includes('V0')&&row[3].includes('V3'));assert.deepEqual(fr.sourceSequence,route.representativeSequence);
 const g=fr.graph,b=g.bonds,s=fr.selector,hash=createHash('sha256').update(JSON.stringify(g)).digest('hex');assert.equal(hash,fr.graphDigest);
 assert.equal(g.atomOrigins.length,g.atoms.length);assert.equal(new Set(g.atomOrigins.map(o=>o.instanceId+':'+o.sourceAtomIndex)).size,g.atoms.length);
 for(const o of [1,2,3])assert.deepEqual(s.orders[o],b.flatMap((edge,i)=>edge.order===o?[i]:[]));
 for(const ring of s.rings){assert.equal(ring.length,6);assert.equal(b.filter(e=>ring.includes(e.a)&&ring.includes(e.b)).length,6)}
 assert.equal(fr.measurements.length,3);assert.ok(fr.layout.diagnostics.accepted);
 for(const p of fr.measurements){assert.ok(p.best.fits);assert.ok(p.best.centerError<=1);assert.ok(p.best.occupancy>=.70&&p.best.occupancy<=.94);assert.ok(p.best.qMin>=20);assert.ok(p.best.minHeavy>=6);if(p.best.minH!==null)assert.ok(p.best.minH>=4)}
}
assert.deepEqual([...allV].sort(),Array.from({length:9},(_,i)=>'V'+i));
for(let i=1;i<=9;i++)assert.ok(matrix.includes('C'+String(i).padStart(2,'0')));
for(let i=1;i<=15;i++)assert.ok(spec.includes('A'+String(i).padStart(2,'0')));
assert.ok(spec.includes('M1–M9')); // inherited review rubric, not automatic semantic approval
const pan=f.rows.find(r=>r.polymerId==='polyacrylonitrile'),nbr=f.rows.find(r=>r.polymerId==='nitrile-butadiene-rubber'),pf=f.rows.find(r=>r.polymerId==='phenol-formaldehyde-resin');
assert.equal(pan.selector.nitrile.length,4);assert.equal(nbr.selector.nitrile.length,1);assert.equal(pf.selector.rings.length,2);assert.equal(pf.selector.methyleneBridge.length,1);assert.equal(pf.selector.hydroxymethyl.length,1);
assert.equal(pf.evidence.byproducts.filter(p=>p.species==='water').length,1);assert.ok(spec.includes('L2'));assert.ok(spec.includes('CONCEPT_SEPARATE'));
for(const image of m){const p=prefix+'evidence/'+image.file;assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),image.sha256);assert.equal(image.sourceSha,f.sourceSha);assert.equal(image.kind,'BASELINE_CURRENT')}
for(const p of [prefix+'visual-spec.md',prefix+'visual-matrix.md',prefix+'visual-evidence.md',prefix+'evidence/reproduce-projections.md', 'docs/architecture.md']){
 const text=await readFile(p,'utf8');assert.equal((text.match(/^```/gm)??[]).length%2,0);
 for(const match of text.matchAll(/\]\(([^\s)]+)\)/g)){const link=match[1];if(/^(https?:|#)/.test(link))continue;await stat(resolve(dirname(p),link.split('#')[0]))}
}
const changes=execFileSync('git',['diff','--name-only','905ba4f1fb4a0e6d63e658a9f178ac29ad8beb49'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.ok(changes.every(p=>p==='docs/architecture.md'||p.startsWith(prefix)),'scope must be Task3 docs/evidence only');
console.log('PASS: 25 route/E/V pairs; 9 C cases; 75 fits/units; real graph target invariants; 9 baseline image digests; links/fences/scope');
```

## 7. Results and limitations

実行結果、独立review識別/指摘と修正、PR/CI/merge/main SHAはTask③ PRの記録をpublication authorityとする。正本の開始SHAをmerge SHAに置き換えない。以下は今回のlocal検証範囲であり、完成rendererの受入表ではない。

| 実施検証 | 結果 / 範囲 |
|---|---|
| 本書checker | PASS: 25 route/E/V、C01–C09、75fit/units、target集合、画像hash、relative links/fences/scope |
| projection再現 | PASS: 同sourceで全25 graph/selector/coordinates/75viewのJSON一致。受入rasterではない |
| route/Core/geometry | PASS: `node --test tests/polymerization-routes.test.mjs tests/reaction-lab-polymerization-fixtures.test.mjs tests/polymer-fragment-3d-layout.test.mjs`、33 tests / 0 fail / 0 skip |
| repository hygiene | PASS: 794 files / 137 reachable production modules / 0 warnings（temporary reproduction scriptは除外して最終再確認） |
| PWA/whitespace | PASS: `node scripts/build-precache.mjs --check`、`node tests/pwa.test.mjs`、353 hashed assets、`git diff --check`。再生成なし |
| fresh browser / GPU campaign / child study | NOT_RUN、既存exact-main CI画像と独立したprojectionのみ。既存runのFAILを保持 |

これらの実結果とpublication authorityをPRにも保存する。
- 独立reviewは別agentが全25/E/V/C、graph selectors、数値/fit、M1–M9を反証検討する。自己reviewを独立と呼ばない。
- 未実装: Task④geometry改善、⑤3lane/fit/凡例/注釈/比較/UX、全target raster、実機、児童、性能統合。現rendererの外観完成PASSなし。
- 残存: L1は⑤、PF L2は化学評価留保、#345/現mainの性能FAILは別記したまま。Task③の設計CLOSEDはこれらを解消した意味ではない。
