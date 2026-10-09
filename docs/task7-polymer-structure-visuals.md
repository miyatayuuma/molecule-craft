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

9件すべてについて、実Collection detailをChromiumで390×844と1280×900に設定して表示し、各SVGの読み込み、polymerId、代替テキスト、画像全体の可視範囲、横overflowがないことを確認しました。9件×2 viewportの全画面PNG、同じ画面から切り出したstructure crop 18枚、manifestを生成しました。

全pilotのstructure cropを並べたcontact sheetは[Task⑦ Collection detail visual QA contact sheet](task7-collection-detail-contact-sheet.jpg)です。元の全画面PNGとcropは[GitHub Actions run #87 artifact](https://github.com/miyatayuuma/molecule-craft/actions/runs/37890636591/artifacts/11597809463)のtest-results/task7-polymer-visual-qaに保存されています。全画面ファイル名は各polymerIdに-mobile.png / -desktop.pngを付けた18件です。

| Pilot | 描画とauthorityの照合 | atom / bond | 構造解釈・layout review | Mobile 390×844 | Desktop 1280×900 |
|---|---|---|---|---|---|
| PE | PASS | PASS | PASS — 主鎖、repeat bracket、左右port | PASS — polyethylene-mobile.png | PASS — polyethylene-desktop.png |
| PP | PASS | PASS | PASS — methyl側鎖、stereochemistry非断定 | PASS — polypropylene-mobile.png | PASS — polypropylene-desktop.png |
| PVC | PASS | PASS | PASS — 主鎖のCl置換 | PASS — polyvinyl-chloride-mobile.png | PASS — polyvinyl-chloride-desktop.png |
| PS | PASS | PASS | PASS — pendant phenyl、芳香族二重結合 | PASS — polystyrene-mobile.png | PASS — polystyrene-desktop.png |
| PET | PASS | PASS | PASS — terephthalate / ethylene glycol残基、ester / carbonyl | PASS — polyethylene-terephthalate-mobile.png | PASS — polyethylene-terephthalate-desktop.png |
| Nylon 6,6 | PASS | PASS | PASS — carbonyl / amide、異なるmethylene鎖 | PASS — nylon-6-6-mobile.png | PASS — nylon-6-6-desktop.png |
| PTFE | PASS | PASS | PASS — CF₂主鎖と4個のF | PASS — polytetrafluoroethylene-mobile.png | PASS — polytetrafluoroethylene-desktop.png |
| SBR | PASS | PASS | PASS — 1,4-butadiene残存C=C、styrene phenyl、local sequence | PASS — styrene-butadiene-copolymer-mobile.png | PASS — styrene-butadiene-copolymer-desktop.png |
| Phenol-formaldehyde | PASS | PASS | PASS — 独立motif、4環、3 bridge / 3 branch、OHとSample caveat | PASS — phenol-formaldehyde-resin-mobile.png | PASS — phenol-formaldehyde-resin-desktop.png |

画面では白い図版面と原子色が背景から分離しており、repeat bracket、continuation、PET/Nylonのcarbonyl、SBRの残存二重結合、networkの三方向branchと注意書きが読めます。未知entryの画像非表示と既知entryのdetail導線は既存Collection browser regressionでも確認しました。

Task⑧ではPOLYMER_2D_PILOT_IDSへ対象IDを追加し、同じ静的描画・validator・browser screenshot手順を適用できます。今回の9件以外の16 assetは変更していません。
