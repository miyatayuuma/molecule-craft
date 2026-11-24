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
