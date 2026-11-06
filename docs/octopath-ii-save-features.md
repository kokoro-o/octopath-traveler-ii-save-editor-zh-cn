# 八方旅人 II：习得技能与捕获魔物编辑

## 使用入口

- `角色 → 光（Hikari，第一项）→ 习得技能`
- `角色 → 欧修缇（Ochette）→ 捕获魔物`

习得技能可按中文名或 AbilitySetID 搜索选择，清空使用 `-1`。添加槽位
只追加空槽；超过五槽会显示实验性提示。至少保留默认五槽，额外槽位可以
删除；删除和恢复五槽会先列出将移除的技能并要求确认。

底部“剧情备份管理（高级）”展示备份内容。只有“同步当前技能到剧情备份”
和“从备份恢复”两个按钮会调用备份函数，两者均要求确认。普通技能替换、
清空、增删槽位和导出不会自动同步备份。

捕获魔物的普通与传说列表分别固定为十槽。普通列表可选择 normal/partner，
传说列表仅选择 legend。更换种类保留 Count 和 Used；选择空槽或点击清空
会准确重置为 `{ EnemyID: -1, Count: 0, Used: false }`。次数可输入 Int32
整数或点击“填入字典 countMax”；Used 位于每槽的高级折叠区。

## 横向条目、信息展示与排序

两个页面均采用横向条目：左侧为槽位序号、拖拽把手和上下移按钮，中部为
编辑控件，右侧为说明。窄屏自动将说明放到编辑区下方，保留完整换行。
技能展示完整官方说明及消耗；三个叶币技能和一个百分比 SP 技能分别使用
正确的单位。魔物展示强度星级、所有召唤技能的名称和攻击属性简述、可加工
产物；未知 ID 或空槽不生成说明区。

上下移和 HTML5 原生拖拽共用纯函数的 splice 移动逻辑。魔物的 EnemyID、
Count、Used 整条移动，且只能在同一个数组中排序。有效变化标记 dirty；
同位置放下、取消、外部拖入、跨列表或拖拽期间数据已变化时不应用排序。
触屏可使用上下移按钮，不依赖 HTML5 拖拽支持。项目原有全局 CSS 禁止
原生拖拽，新条目通过局部样式恢复，不影响其他编辑器。

排序不会同步剧情备份；选择器中的搜索词也不会用于过滤底层数组或丢弃未知
ID。攻击属性不代表敌人弱点，召唤简述不是完整伤害公式。

未知 ID 显示原始数字，搜索和修改其他字段不会清除它；字典分类外的已有值
同样保留。缺失的字段、非十槽魔物数组或未知 Struct 子字段会显示不可编辑，
不会自动补齐、截断或重建。

## 实现边界

数据函数位于 `saveEditor/utils/learned-abilities.ts` 和
`captured-monsters.ts`，返回 `{ data, changed }`，不修改输入对象、不访问
store。`save-feature-store.ts` 只在有效变化时更新 `dataJson` 并标记全局
`isDirty`。搜索、展开折叠区、无效输入、无变化选择以及取消确认不会标脏。

新组件使用既有的 `beforeSaving()` 和 GVAS writer。没有更改 PAK、阶段一
字典、GVAS 核心或既有初始化规则。魔物字典使用已验收的 InvadeData.ID，
并未新增“强度”等存档字段。

## 验证

```sh
npm run check
node --test scripts/tests/octopath-ii-items.unit.test.mjs \
  scripts/tests/octopath-ii-native-structs.unit.test.mjs \
  scripts/tests/octopath-ii-save-dictionaries.unit.test.mjs \
  scripts/tests/octopath-ii-badges.unit.test.mjs \
  scripts/tests/octopath-ii-save-features.unit.test.mjs
npx playwright test --config scripts/tests/octopath-ii-save-features.playwright.config.mjs
```

新布局与排序用例位于 `scripts/tests/octopath-ii-save-layout.spec.ts`。可通过
`OT2_FEATURES_OUTPUT` 指定独立的浏览器测试输出目录，保留其他轮次的证据。

本轮布局与排序验收：类型检查 0 错误、0 警告；63 项单元/数据测试、5 项真实
资产字典集成测试、53 项浏览器测试通过，无跳过或不稳定重试。包含桌面真实
鼠标拖拽、移动端上下移、排序保存重载、未知 ID 隐藏说明、取消/跨列表拒绝
以及既有物品和原编辑器回归。原有 191/500 条字典的 ID 与名称均保留。

阶段二原验收：类型检查 0 错误、0 警告；57 项单元/数据测试、12 项新功能浏览器
测试及 33 项已有浏览器回归通过。浏览器覆盖桌面和 390px 移动布局，包含
取消/接受确认、未知 ID、输入校验、固定十槽、导出重载及完整解码对象比较。
只用样本副本生成测试输出，原文件保留。

两个样本的无修改导出保留以下既有行为，不把它们算成新增功能的验证成果：

- MJSaveData2：已解析属性一致，writer 仍丢弃原文件末尾额外 87 字节；
  新输出逐字节等于原文件此前的有效前缀。
- Steam SaveData0.sav：直接 GVAS 往返逐字节一致；完整编辑器仍在 onReady
  中补入缺失的八个 `-1` SubMemberID。浏览器比较只允许这一项明确变化。

尚未实测游戏内第六槽以后的显示、生效、习得/遗忘、剧情恢复或再次保存行为。
Count/Used 的任意设置也不代表已解除游戏自身的召唤规则。
