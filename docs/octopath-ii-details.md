> 以下为迁移前保留的功能设计与历史验证记录；部分本机专用集成/浏览器测试配置不随仓库发布。当前通用验证入口见 README 的 `npm run test:unit` 与 `npm run check`。

# 物品详情与搜索：B+C 交付

已接入现有编辑器。使用阶段 A `session-001/accepted-a`，没有重新解析 PAK、安装依赖或修改阶段 A 证据。

## 使用

本次演示服务：http://127.0.0.1:5186/octopath-traveler-ii/save-editor

重新启动：在项目目录执行 `npm run dev -- --host 127.0.0.1 --port 5186 --strictPort`。

1. 导入存档副本，进入“背包”。全部分类均直接展示紧凑卡片、60px 数量框、非零属性及效果标签，无需点击详情。
2. 输入中文、英文、类别、说明或效果关键词；输入搜索时切换至全部分类，再点击分类可缩小结果。
3. 可组合非零装备属性筛选和“有效果或抗性记录”，点击清除恢复道具分类。
4. 进入“角色 → 装备”，点击“查看当前装备详情”；输入候选名称后，点击右侧“详情”仅预览，点击物品名称才更换装备。两处共用 ItemCard 与 item-badges，空官方说明不渲染。

样板“测试物品”分类已移除。按项目所有者明确指定的展示规则：坚果成长标签使用带符号数值（最大HP +75、物攻 +7）；武器和六系属性威力值大于100时显示 +(数值−100)%（130 → +30%）。背包与装备预览共用此规则，底层数据库保留全部原始字段。

全部 956 项共用 `getItemDetails` 查询。装备保留 13 个字段，正负值分别显示；空说明、None 引用分别说明。新月项链仍在贵重物品中，同时说明游戏中的饰品分类。

数量继续通过原 change 回调提交。仅本模板开启草稿保护：其他字段更新不覆盖未提交输入；筛选、分类或标签页卸载输入时提交草稿；卸载存档时丢弃草稿，不带入下一个存档。

## 文件

新增 9 个文件：

| 文件 | 职责 |
|---|---|
| `scripts/octopath-ii-details.mjs` | 从已验收 JSON 生成精简运行时数据；不读取 PAK |
| `src/lib/templates/octopath-traveler-ii/saveEditor/data/items.json` | 956 项详情、原始参数及必要分支引用 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/utils/item-details.ts` | 类型、数字 ID 查询、共享搜索索引和筛选 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/components/ItemDetails.svelte` | 装备预览与折叠来源信息 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/components/InventoryBrowser.svelte` | 全量卡片、原分类、数量控件与搜索筛选 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/components/EquipmentField.svelte` | 保留原装备输入的详情包装 |
| `scripts/tests/octopath-ii-details.spec.ts` | 数据、UI、数量草稿与存档逐字段回归 |
| `scripts/tests/octopath-ii-details.playwright.config.mjs` | 独立端口、临时浏览器及输出；不复制项目 |
| `docs/octopath-ii-details.md` | 本说明与交付记录 |

修改 5 个文件：

| 文件 | 改动 |
|---|---|
| `src/lib/components/Input.svelte` | 默认关闭的 preserveDraft；原默认行为保留 |
| `src/lib/components/Items/Int.svelte` | 可选草稿保护、候选名称格式、预览回调与插槽 |
| `src/lib/components/Autocomplete.svelte` | 可选候选详情按钮，物品名称和预览按钮分开 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/template.ts` | 接入背包浏览及包装原装备字段 |
| `src/lib/templates/octopath-traveler-ii/saveEditor/utils.ts` | 仅新增 UI 组件导入与注册；原存档函数逐字保持一致 |

全量推广另有 `components/ItemCard.svelte` 与 `utils/item-badges.ts`，由样板组件和格式化模块转为正式共享实现。

`resource.ts`、旧翻译、GVAS、其他游戏模板、依赖及配置未修改。没有 commit、push、reset、clean、部署或阶段 D/E 修复。

## 数据与加载

- 来源：Switch 1.1.1，956 项，526 件装备，606 项非空官方说明。
- JSON：1,340,363 字节；gzip 压缩度量：66,283 字节。实际 HTTP 压缩由部署配置决定。
- 静态模块随本游戏加载，共享同一数据实例；前端不读取 PAK 或大型审计表。
- 本地开发服务、新浏览器上下文的一次测量：页面加载 1,182ms；进入背包并显示详情 119ms。Vite 展开的 JSON 模块传输约 1.63MB，请求 6ms。这不是生产性能承诺。
- 生成命令：`node scripts/octopath-ii-details.mjs`。仅在需要重新生成运行时 JSON 时执行，不需要重新运行阶段 A。

## 实际验证

- `npm run check`：0 错误、0 警告。
- `node node_modules/@playwright/test/cli.js test --config scripts/tests/octopath-ii-details.playwright.config.mjs`：30 项通过，0 失败、0 跳过。
- 其中 20 项是数据、全量卡片与桌面/移动布局验证；10 项为原有 Super Mario 64 回归。
- Steam/Switch：查看详情、搜索筛选、预览候选不修改存档；装备更换仅改变目标字段；数量草稿经筛选卸载、其他字段更新、分类/标签页切换及导出重读保留。
- 覆盖 0/1/99、合成未知 ID、原始空说明/None、负属性、抗性、调合及随机分支，以及新月项链分类差异。
- Steam 对比仅允许既有的八个 -1 `SubMemberID` 初始化；其他解码字段精确比较，没有新增差异。严格原始无修改一致性的问题仍然存在。
- 原始 Steam/Switch 存档 SHA-256 在测试前后校验一致，写入只发生在测试副本与下载中。
- 检查 2,883 个未授权修改的原有项目文件：无异常变化；阶段 A 核心脚本与固定样本哈希一致；存档核心函数与原版文本一致。
- `git diff --check` 通过。未覆盖原有 build；本次未执行生产构建。

测试结果、截图、加载测量及保护记录位于 `.local/ot2-details-qa/`（非阶段 A 目录）。开发过程中发现的候选名称/详情点击区域冲突已修正，最后完整回归为上述 30 项通过。

## 保留的限制

独立 UE 工具交叉验证、真实游戏和实体手机验证未进行。运行时来源中的 `unknownParsedTypes` 明确为 `not-separately-counted`，没有改写阶段 A 的旧报告。坚果与威力标签采用上述业务展示规则；其他概率字段、随机权重与最终计算不推断；抗性索引未完整验证的部分按原始索引展示。Steam 初始化及背包无空槽 TypeError 保留原状。

标签格式单元测试：`node --test scripts/tests/octopath-ii-badges.unit.test.mjs`。覆盖130/120、六系属性、成长值符号、100边界、无关效果及原始数据保持不变。
