# Task⑦ 高分子2D構造図パイプライン

## 目的と境界

図鑑で使う高分子の代表局所構造を、Task⑥の検証済み構造authorityからbuild-timeで生成します。描画座標は図示専用で、分子座標、立体配座、tacticityを表しません。ゲーム実行中に構造layoutやphysicsを起動しません。

新方式で置換するpilotは次の9件です。残り16件のSVGはTask⑧まで既存生成方式のまま維持します。

| polymerId | 検証する特徴 |
|---|---|
| `polyethylene` | 主鎖、反復括弧、両側continuation |
| `polypropylene` | methyl側鎖、未指定立体配置 |
| `polyvinyl-chloride` | Cl置換 |
| `polystyrene` | 主鎖側のphenyl基、芳香環 |
| `polyethylene-terephthalate` | terephthalate、ethylene glycol、ester |
| `nylon-6-6` | carbonyl / amide、異なるmethylene鎖 |
| `polytetrafluoroethylene` | CF₂主鎖と4個のF |
| `styrene-butadiene-copolymer` | styrene / 1,4-butadiene局所配列、残存C=C |
| `phenol-formaldehyde-resin` | 独立した四芳香環・三methylene bridge network motif |

## Pipeline API

| 段階 | API / module | 契約 |
|---|---|---|
| Source read | `readPolymerFragmentSources()` | Task⑥ authorityと既存sourceを読む |
| Validation | `validatePolymerFragmentAuthority()` | authorityとsourceの整合を検証 |
| Input adapter | `createPolymerDrawingInput(authority, polymerId, sources)` | validated drawing inputだけをrendererへ渡す |
| Layout | `createPolymerStructureLayout(input)` | deterministic 2D位置、label、port、ring metadataを作る |
| SVG | `renderPolymerStructureSvg(input, options)` | atom/bond mappingを維持したstandalone SVGを作る |
| SVG gate | `validatePolymerStructureSvg(svg, input)` | ID、atom/bond order、accessibility、qualifier、外部参照を確認 |
| Build | `generatePolymerStructureAssets()` | 現在は9 pilotのみを既存pathへ出力 |

生成経路は `scripts/build-collection-assets.mjs` が管理します。新方式対象9件はlegacy loopから除外され、その他16件は従来通り生成されます。Collectionは引き続き `assets/models/polymer-{polymerId}.svg` を表示します。

## SVG規約

- `viewBox="0 0 960 540"`、SVG単体、外部font/image/script/referenceなし。
- accessible `<title>` / `<desc>` と `data-polymer-id`、generator version、Task⑥ source commitを含む。
- SVG metadataに全authority atom/bond、source、描画座標、repeat/component/functional group/continuation mappingを保存。
- carbon-bound hydrogenは表示上省略可能。明示Hはmapping metadataに保持し、O–H/N–HはOH/NH表記にまとめる。
- single/double/triple bondのpath本数をbond orderに対応させる。芳香環はTask⑥の交互single/double graphを描く。
- linear repeatのみbracketと `n` を表示。copolymerはlocal segmentと注記を使い、固定repeatや比率を示さない。networkにはlinear bracketを付けない。
- phenol-formaldehydeは `independent-encyclopedia-motif` provenanceと4芳香環・3 bridge・3 portを必須とする。Sample由来geometryへ置き換えない。
- 描画前にvalidation status、graph references/order、representation-specific qualifiersを検査し、失敗時は `polymerId` と原因で停止。

## 再生成と検証

```bash
node scripts/build-collection-assets.mjs
node tests/polymer-structure-svg.test.mjs
node scripts/build-precache.mjs
node scripts/build-precache.mjs --check
```

同一source/authority/generator versionでSVG bytesが一致しなければ失敗とします。Task⑥ validatorは25/25、Task⑦ drawing inputはpilot 9/9で確認します。`precache-manifest.js` と `sw.js` はSVG生成後に既存precache手順で更新します。手動hash変更はしません。

## Task⑧への拡張

1. `POLYMER_2D_PILOT_IDS` に追加するIDについて、Task⑥ validated drawing inputとrepresentationを確認する。
2. 既存layout ruleで失敗する場合だけ `polymerId` に限定した決定論的placement hintを追加する。hintは座標だけを制御し、graphを編集しない。
3. element/bond/backbone/side-chain/repeat/component/ports/qualifier mappingのtestとnegative caseを追加する。
4. 追加するSVGだけを生成し、未対象polymer assetのdiffがないことを確認する。
5. 実Collection detailをmobile 390×844とdesktop 1280×900で表示し、各viewport screenshotと構造・可読性reviewを保存する。
6. 25件完了後に`node scripts/build-precache.mjs`と`--check`を実行する。

## Task⑦ evidence status

Task⑦のコード・asset生成器・validatorは実装済みです。9件のSVGを静的raster previewへ出力し、960×540と約350×197表示サイズで構造の配置を確認しました。ここでは主鎖、置換基、芳香族二重結合、官能基、repeat bracket、network分岐とlabel/bond衝突を確認しています。preview環境に日本語フォントがなく、日本語の文字可読性はこの確認で証明できません。これらはCollection browser screenshotではありません。

| Pilot | 描画とauthorityの照合 | atom / bond | 構造解釈・静的layout review | Collection mobile 390×844 | Collection desktop 1280×900 |
|---|---|---|---|---|---|
| PE | PASS | PASS | PASS — 主鎖、bracket、左右port | 未実施 | 未実施 |
| PP | PASS | PASS | PASS — methyl側鎖、stereochemistry非断定 | 未実施 | 未実施 |
| PVC | PASS | PASS | PASS — 主鎖のCl置換 | 未実施 | 未実施 |
| PS | PASS | PASS | PASS — pendant phenyl、芳香族二重結合 | 未実施 | 未実施 |
| PET | PASS | PASS | PASS — terephthalate / ethylene glycol残基、ester / carbonyl | 未実施 | 未実施 |
| Nylon 6,6 | PASS | PASS | PASS — carbonyl / amide、異なるmethylene鎖 | 未実施 | 未実施 |
| PTFE | PASS | PASS | PASS — CF₂主鎖と4個のF | 未実施 | 未実施 |
| SBR | PASS | PASS | PASS — 1,4-butadiene残存C=C、styrene phenyl、local sequence | 未実施 | 未実施 |
| Phenol-formaldehyde | PASS | PASS | PASS — 独立motif、4環、3 bridge / 3 branch、OH | 未実施 | 未実施 |

このworkspaceにはlocal Chromium executableがなく、`tests/collection-polymer-browser.test.mjs` はsandboxのloopback server権限で起動できませんでした。Cloud Browserからlocalhost previewを開く操作は、自動審査でrepository source/assetsを外部browserへ公開するriskを理由に拒否されています。承認済みの代替手段が用意されるまで、実Collection screenのmobile/desktop screenshotは未取得です。画像自体は実Collection画面で確認できていないため、このrecordではMobile / Desktop visual QAをPASS扱いしません。

**Task⑦の完了条件として、実Collection detailでの9件×2 viewport確認とscreenshot evidenceが残っています。** この確認が終わるまでTask⑦はCLOSEDとしません。
