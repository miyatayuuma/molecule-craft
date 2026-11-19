# 状態のへんか装置の物性と結晶データ

温度は °C、圧力は atm。境界表は 0.5 から 3 atm まで 0.05 atm 刻みで、線形補間を両方向で共用する。換算は 1 atm = 101325 Pa。表の外では圧力範囲の上下だけを判定する。

| 圧力 (atm) | CO₂ の昇華温度 (°C) | エタノールの沸騰温度 (°C) |
| ---: | ---: | ---: |
| 0.5 | −86.57 | 61.82 |
| 1 | −78.46 | 78.42 |
| 2 | −69.66 | 97.08 |
| 3 | −64.17 | 109.13 |

## 二酸化炭素

- [Span–Wagner](https://srd.nist.gov/jpcrdreprint/1.555991.pdf) 式 3.12 の昇華圧を各格子圧に対して 180–216.592 K の二分法で逆算し、273.15 を引いて境界表を生成した。216.592 K、517950 Pa（約 5.11 atm）の三重点を圧力上限が下回るため、固相と気相で体積を分ける。[NIST Chemistry WebBook](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=7) の Antoine 式は採用範囲外を含むため使っていない。
- [CrystalMaker の Pa-3 単位胞](https://som.web.cmu.edu/structures/S104-CO2.html) と [Pa-3 の対称操作](https://cci.lbl.gov/cctbx/cctbx_web.cgi?sgsymbol=P+a+-3&target_module=explore_symmetry) を基に、4 サイトを繰り返し、体対角線方向に分子を向けた結晶を円筒内に切り出した。64 分子の位置に熱振動を加え、配向は格子に拘束する。分子内の構造と結合次数は図鑑 DB を使う。

## エタノール

- [CoolProp 8.0.0](https://coolprop.org/fluid_properties/fluids/Ethanol.html) の HEOS で各格子圧の飽和液温度を `PropsSI('T','P',pPa,'Q',0,'Ethanol')` から取得した。1 atm の 78.42 °C は図鑑の 78.4 °C と [NIST Chemistry WebBook](https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=14) の 351.5 ± 0.2 K に一致する。融点は NIST 掲載の 159 ± 2 K に基づき −114 °C とした。
- [Jönsson の 87 K X 線回折構造](https://doi.org/10.1107/S0567740876002653) 表 1 の重原子座標と単斜晶 Pc 単位胞を使用した。2 種の独立分子に c 映進を施すと酸素間距離 2.716 Å、2.730 Å のジグザグ鎖が現れる。画面では酸素位置と炭素骨格の向きを合わせ、分子内の形状は全相で図鑑の単一の剛体配座を使う。結晶内の trans/gauche の違いと固体多形は省略した。
- 液相では 40 分子の姿勢を Stage A と描画で共有する。原子間の静電・分散相互作用を 10 Hz で評価し、液体の流れと組み合わせる。

両物質とも、容器内で相の違いを見分けられるよう凝縮相の表示体積を拡大している。気相体積は理想気体の温度・圧力依存を用い、凝縮相には操作用のばねと小さな表示上の圧縮を加える。相変化の時間、結晶粒の成長、粒子速度は観察用のモデル値。
