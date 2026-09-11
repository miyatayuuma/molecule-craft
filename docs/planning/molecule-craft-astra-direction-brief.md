# Molecule Craft — post-CHO gameplay direction

Status: **D — active future direction, not an implementation contract.**

現行productionの設計原則は `../game-design.md`、H/C/O探索は `../hco-growth.md` をsource of truthとします。この文書には、CHO後にまだ実装していない方向性だけを残します。

## Current baseline

CHOでは既に、次の基盤が存在します。

- 分子別propellant / fuel / coolant性能
- 4用途LOADOUTと出発時自動錬成
- fuel response、O₂需要、heat、coolantのtrade-off
- 36 → 48 → 72のO₂恒久強化
- 複数route、逆流、熱、vortex等の物理的challenge
- 分子IDを直接鍵にしない複数解法

したがって、これらを「次に作る新機能」として再計画しません。

## Remaining design problem

CHO以降も広い分子DBを活かすには、propulsionだけでなく、**新しい分子を発見すると新しい攻略方法や資源判断が増える**縦切りを追加する必要があります。

次の候補は、実装タスクで一つずつ検証します。

### Next-element vertical slice

H/C/O以外の元素を、周期表順ではなく「一つの新しい意味あるgameplay loopを成立させるか」で選びます。

候補元素は未確定です。NはNH₃/N₂など既存roleとの接続が強い候補ですが、この文書だけを根拠にNへ固定しません。

新元素を導入する場合は、少なくとも次のどれかへ実用上つながることを求めます。

- 新しいpropulsion / coolant trade-off
- repair / processing
- material / shell interaction
- environmentへの別解

### Environment × molecule performance

高温、低温、圧力、腐食性、電気的干渉などのenvironmentを、単一分子keyではなく連続的な性能差として扱う候補です。

同じ問題へ、安価な分子を多く使う、専門分子で余裕を作る、休止やrouteで回避する等の複数解を残します。

### Material / shell interaction

acid、solvent、polymer precursor等の化学的性質を、deposit処理、coating除去、repair、refinementへ接続する候補です。

実装する場合も「分子Xだけが開ける鍵」にはせず、複数の化学的に妥当な候補が効率・コスト・副作用で差を持つ形を優先します。

### Encyclopedia connection

図鑑は一般的なskill treeへ変えません。発見した化学構造や性質から、次に試せる用途・候補を理解できるreferenceとして使います。production UIへ長い攻略説明を重複させません。

## Vertical-slice rule

一度に全元素・全分子・全fieldへ展開しません。

```text
新しい分子／元素を発見
→ 新しい物理的・資源的な選択が増える
→ その差が意味を持つfield challengeを一つ用意
→ 複数構成で実際に攻略可能か検証
→ 面白さが成立してから横展開
```

次の具体的な元素、分子、environment、報酬、実装順は未確定です。将来タスクが採用するまでは、候補をproduction仕様として扱いません。
