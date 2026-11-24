# 状態のへんか装置の物性と結晶データ

温度は °C、圧力は atm。境界表は 0.5 から 3 atm まで 0.05 atm 刻みで、線形補間を両方向で共用する。換算は 1 atm = 101325 Pa。表の外では圧力範囲の上下だけを判定する。

| 圧力 (atm) | CO₂ の昇華温度 (°C) | エタノールの沸騰温度 (°C) | ジメチルエーテルの沸騰温度 (°C) | 酢酸の沸騰温度 (°C) |
| ---: | ---: | ---: | ---: | ---: |
| 0.5 | −86.57 | 61.82 | −39.61 | 96.81 |
| 1 | −78.46 | 78.42 | −24.78 | 118.01 |
| 2 | −69.66 | 97.08 | −7.59 | 142.15 |
| 3 | −64.17 | 109.13 | 3.80 | 157.87 |

## 二酸化炭素

- [Span–Wagner](https://srd.nist.gov/jpcrdreprint/1.555991.pdf) 式 3.12 の昇華圧を各格子圧に対して 180–216.592 K の二分法で逆算し、273.15 を引いて境界表を生成した。216.592 K、517950 Pa（約 5.11 atm）の三重点を圧力上限が下回るため、固相と気相で体積を分ける。[NIST Chemistry WebBook](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=7) の Antoine 式は採用範囲外を含むため使っていない。
- [CrystalMaker の Pa-3 単位胞](https://som.web.cmu.edu/structures/S104-CO2.html) と [Pa-3 の対称操作](https://cci.lbl.gov/cctbx/cctbx_web.cgi?sgsymbol=P+a+-3&target_module=explore_symmetry) を基に、4 サイトを繰り返し、体対角線方向に分子を向けた結晶を円筒内に切り出した。64 分子の位置に熱振動を加え、配向は格子に拘束する。分子内の構造と結合次数は図鑑 DB を使う。

## エタノール

- [CoolProp 8.0.0](https://coolprop.org/fluid_properties/fluids/Ethanol.html) の HEOS で各格子圧の飽和液温度を `PropsSI('T','P',pPa,'Q',0,'Ethanol')` から取得した。1 atm の 78.42 °C は図鑑の 78.4 °C と [NIST Chemistry WebBook](https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=14) の 351.5 ± 0.2 K に一致する。融点は NIST 掲載の 159 ± 2 K に基づき −114 °C とした。
- [Jönsson の 87 K X 線回折構造](https://doi.org/10.1107/S0567740876002653) 表 1 の重原子座標と単斜晶 Pc 単位胞を使用した。2 種の独立分子に c 映進を施すと酸素間距離 2.716 Å、2.730 Å のジグザグ鎖が現れる。画面では酸素位置と炭素骨格の向きを合わせ、分子内の形状は全相で図鑑の単一の剛体配座を使う。結晶内の trans/gauche の違いと固体多形は省略した。
- 50 サイトは同一の周期格子から円筒内に切り出す。

## ジメチルエーテル

- [Wu・Zhou・Lemmon の状態方程式](https://www.nist.gov/system/files/documents/srd/jpcrd402011An.pdf) を実装した [CoolProp 8.1.0 の HEOS](https://coolprop.org/fluid_properties/fluids/DimethylEther.html) で `PropsSI('T','P',pPa,'Q',0,'DimethylEther')` を各格子圧で評価した。融解境界は三重点 131.66 K を温度バーの刻みに合わせて −141.5 °C とした。
- [Vojinović ほかの低温回折](https://doi.org/10.1039/B405684A)、[Sacharczuk ほかの正方晶 P4₂/n と環状配列の記述](https://doi.org/10.1107/S2052252523009995)、[Yarnall・Hudson の密度表](https://science.gsfc.nasa.gov/691/cosmicice/reprints/Yarnall-2022-2931.pdf) に基づき、回転した分子の環を交互に積む近似格子を使う。分子座標は回折値を使わず、密度 0.975 g/cm³（93 K）から見積もった分子あたり約 78.5 Å³ を使って配置する。液密度 0.882 g/cm³ は状態方程式の三重点飽和液を参照した。温度が異なるため、体積比は凝固時の収縮を表す目安とした。

## 酢酸

- [Perry's Chemical Engineers' Handbook 表 2-8](https://iem.ca/pdf/resources/Perrys%20Chemical%20Engineers%20Handbook.pdf) の蒸気圧相関を 289.81–591.95 K 内で逆算した。1 atm の 118.01 °C は [NIST Chemistry WebBook](https://webbook.nist.gov/cgi/cbook.cgi?ID=C64197&Mask=4) の相転移資料と整合する。NIST の Antoine 相関は 391.01 K が上限であり、2・3 atm への外挿は行っていない。
- 融点は 16.6 °C。[PubChem 収録の Merck Index](https://pubchem.ncbi.nlm.nih.gov/compound/176) にある融点近傍の密度（液体 1.053、固体 1.266 g/cm³）を、表示高さの固液比に使った。
- [Jones・Templeton の X 線回折](https://escholarship.org/content/qt3x45b5nd/qt3x45b5nd.pdf) の Pna2₁ 単位胞と重原子座標から、固体の分子列を切り出した。C–C と C=O の向きを合わせ、図鑑の剛体分子を配置する。液体・気体の二量体平衡は扱わない。

## 装置寸法と描画

エタノール・ジメチルエーテル・酢酸は半径 3.20、各 50 分子。液相の姿勢は Stage A と描画で共有する。分子中心間 12 Å 以内のペアを 10 Hz で評価し、静電・分散相互作用を液体の流れと組み合わせる。容器内で相の違いを見分けられるよう凝縮相の表示体積を拡大している。気相体積は理想気体の温度・圧力依存を用い、凝縮相には操作用のばねと小さな表示上の圧縮を加える。相変化の時間、結晶粒の成長、粒子速度は観察用のモデル値。

## P3.5 の9物質

気液境界は [CoolProp 8.1.0 の HEOS](https://coolprop.org/fluid_properties/PurePseudoPure.html) の `PropsSI('T','P',101325*(0.5+i*0.05),'Q',0,fluid)` による。状態方程式名は n-Butane、Benzene、CycloHexane、Oxygen、Chlorine、Nitrogen、Hydrogen（normal H₂）、Ammonia。全8物質の三重点圧力は装置下限の 0.5 atm 未満。融解温度は CoolProp の三重点温度をダイヤル精度に丸めた値を主に採用し、シクロヘキサンは [NIST の通常融点](https://webbook.nist.gov/cgi/cbook.cgi?ID=C110827&Mask=4) に合わせて 6.5 °C。0.5–3 atm での融点変化は表示精度の範囲で省略した。

| 物質 | 融点 °C | 1 atm 沸点 °C | 液体 / 固体密度の目安 g/cm³ | 分子数 | 内径（表示単位） |
| --- | ---: | ---: | ---: | ---: | ---: |
| n-ブタン | −138.25 | −0.49 | 0.735 / 0.81 | 44 | 7.04 |
| ベンゼン | 5.5 | 80.07 | 0.894 / 1.00 | 44 | 7.12 |
| シクロヘキサン | 6.5 | 80.71 | 0.791 / 0.845 | 44 | 7.30 |
| 酸素 | −218.8 | −182.96 | 1.306 / 1.32 | 104 | 6.40 |
| 塩素 | −101 | −33.95 | 1.744 / 2.04 | 78 | 6.56 |
| 窒素 | −210 | −195.79 | 0.867 / 0.94 | 112 | 6.40 |
| 水素 | −259.2 | −252.78 | 0.0770 / 0.088 | 124 | 6.40 |
| アンモニア | −77.7 | −33.32 | 0.734 / 0.85 | 70 | 6.56 |
| グリセリン | 18 | 約290（装置範囲外） | 1.261 / 1.37 | 40 | 7.20 |

液密度は HEOS の三重点近傍の飽和液密度、グリセリンのみ [20 °C 付近の測定値](https://www.thermofisher.com/order/catalog/product/158920010) を採用した。固体密度は文献の単位胞や分子充填から丸めた目安で、n-ブタンとグリセリンは充填モデルによる概算。比率だけを固液の表示高さに用いる。装置は均一な温度と単一の純物質を仮定し、ばね力や凝縮相表示体積、減衰・分子速度を操作しやすく調整している。格子の比率と各分子の形状を保ち、格子間隔と模型の縮尺は読みやすさに合わせて個別に調整する。分子の圧力と熱力学的な体積を模型粒子の衝突から求める方式ではない。

### 結晶と分子運動

- **n-ブタン**：25 °C の飽和圧は HEOS で 2.401 atm。両相が残る間は既存のてこの関係で表示体積を気体と液体に配分する。固相は [Refson の計算による P2₁/c 候補](https://doi.org/10.1016/0378-4363(85)90158-5) を参照した傾斜鎖の配置。実測結晶の座標は使っていない。気液では中央 C–C 軸のまわりの小振幅回転を描画し、相平衡には剛体近似を使う。
- **ベンゼン**：[Cox の常圧回折](https://doi.org/10.1038/173075a0) と [AFLOW の Pbca 構造](https://aflow.duke.edu/prototype-encyclopedia/AB_oP48_61_3c_3c-001/) の単位胞・分子中心を使う。環法線を c 軸から約50°傾け、対称操作に対応する向きに配置してヘリンボーンを作る。環面内の回転角は簡略化。装置を横にドラッグすると異なる投影で見られる。
- **シクロヘキサン**：[Bernès と Camargo の相 I](https://doi.org/10.1107/S2414314623001141) の Fm-3m 格子。椅子形の中心は結晶点の周囲に留まり、配向は連続して変わる。下限 −25 °C は相 I の範囲内。
- **酸素**：[中性子回折による γ 相](https://doi.org/10.1103/PhysRevB.7.3102) の Pm-3n 格子。体心と隅の分子は回転し、鎖状の6サイトは優先配向のまわりに揺れる。下限 −227 °C は γ 相の範囲内。[外観データ](../data/phase-appearance.json) の淡青色を液体の層に適用し、気体は無着色。
- **塩素**：[Donohue と Goodman の回折座標を掲載する Hsu と Williams](https://electronicsandbooks.com/edt/manual/Magazine/I/Inorganic%20Chemistry/18/ic50191a017.pdf) を使用。Cmca の面心位置に分子を置き、交互に傾いた分子軸を再現した。黄緑の気体と琥珀色の液体は外観データを再利用し、気体の濃さを圧力と絶対温度から調整する。酸素と塩素の元素色は共通模型の配色を使う。
- **窒素・水素**：[Schuch と Mills による β-N₂](https://webelements.com/nitrogen/crystal_structure.html) と [NBS の normal H₂](https://nvlpubs.nist.gov/nistpubs/Legacy/MONO/nbsmonograph168.pdf) の六方最密格子を使う。観察範囲では回転する分子軸で配向無秩序を近似する。水素の温度操作は 0.1 °C 刻み、最大 4.2 °C/秒。運動は古典的な表示近似で、量子回転やオルト・パラ転換は扱わない。
- **アンモニア**：[Olovsson と Templeton の回折](https://doi.org/10.1107/S0365110X59002420) を参照し、相 I の P2₁3 単位胞で三角錐分子の孤立電子対側を体対角線に向ける。液相は既存の原子別部分電荷と分散力を 10 Hz で評価し、N–H の向きによる近接分子の力・トルクを反映する。[液体の中性子回折研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC12318028/) と整合する範囲で局所的な配向を扱い、氷のような連続した水素結合網は課さない。
- **グリセリン**：[Kusukawa らの回折による波状シート](https://doi.org/10.1246/bcsj.20120300) を参照した配列。格子寸法と傾きは表示用の近似。[Segur と Oberstar の動的粘度の実測表](https://www.cse.sc.edu/~gatzke/460/EEEE-glycerol.pdf) の20–100 °Cの値を対数補間し、並進と回転の速度に異なる倍率を使う。観察は −5〜100 °C、0.5〜3 atm。[NIST の相変化データ](https://webbook.nist.gov/cgi/cbook.cgi?ID=C56815&Mask=4) の減圧沸点からも、この範囲で安定なバルク気相は生じない。溶融・凝固を示し、熱分解、過冷却、微量の蒸気は省略した。

### 検証方法

`node --test tests/water-phase.test.mjs` で相境界、25 °C の圧縮液化、結晶捕捉、容器端の操作を確認できる。`PHASE_MEASURE=1 python tests/phase-chambers-p35-browser.py` はタッチ対応の 390 × 844 CSS px、DPR 1 の Chromium で実際の個別図鑑を開き、冷却、再加熱、リセットと再入室を操作する。計測値は安定液相で75フレームの requestAnimationFrame 間隔から求め、fps、中央値、p95 をログに出す。Android 実機の計測とは異なる。
