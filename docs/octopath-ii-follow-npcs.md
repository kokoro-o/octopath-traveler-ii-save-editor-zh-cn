> 以下为迁移前保留的功能设计与历史验证记录；部分本机专用集成/浏览器测试配置不随仓库发布。当前通用验证入口见 README 的 `npm run test:unit` 与 `npm run check`。

# 随行 NPC 编辑

入口：角色 → 提米诺斯 / 爱格妮娅 / 帕特提欧 / 欧修缇 → 随行伙伴。
斯洛妮不是随行角色；已按用户确认改为欧修缇。

当前随行和待命列表是顶层共享数组，各四槽，不是每名角色独立拥有四槽。
页面展示全部四槽及归属，其他角色的记录只读。读取本角色记录时保留原数组
下标。填入空槽会设置本角色与正确指令；替换已占用槽只更换 NPC ID，保留
原次数、归属和指令，不会抢占其他角色的记录。

| 角色 | MasterCharacterID | FieldCommandType |
| --- | ---: | ---: |
| 提米诺斯 | 5 | 10（引导） |
| 爱格妮娅 | 8 | 5（诱惑） |
| 帕特提欧 | 4 | 7（雇佣） |
| 欧修缇 | 2 | 16（收服） |

数值来自原版 NSO 的 MJFieldCommandType 枚举注册表；不是 FieldCommandData
的行 ID。创建时使用数据库默认次数，手动输入仅接受 1～2147483647，附 99、
999 按钮。原存档的非正数或未知 ID 在未编辑时完整保留。清空重置四个字段
为 {-1, 0, 0, 0}。上下移与原生拖拽完整移动记录，只在当前数组内排序，
不改变角色归属；无变化、无效输入和只读浏览不标脏。

followNpcs.json 包含 803 个唯一 ID，通过 NPCData.NPC_UnqIndex 关联
NPCLeadData、SupportCharacterDB、AbilityData 和官方中文文本。城镇优先按
最长地图文本前缀解析；无法解析时保留原始区域标签。同一 ID 的剧情别名
合并，来源保存在 followNpcs.report.json，未用后出现的行覆盖旧记录。
有名称不等于已验证游戏内所有剧情条件下均可招募。三个未解析的支援技能
名称引用已记录在报告中，其他已知技能照常显示。

展示补充：`rank` 来自 `SupportCharacterDB.DisplayRank`，有效范围为 1～10。
803 条记录中 797 条有有效星级；6 条原值为 0，保留为 null 并隐藏星级，
不猜测强度。同一唯一 ID 若出现星级冲突，保留来源并隐藏合并后的星级。
`skills` 保留每个支援技能的名称与说明，`skillDesc` 提供完整合并文本。
优先读取技能自身的 `AbilityData.Detail -> GameTextZH_CN`；当前资源的支援
技能没有自身的完整说明引用，因此现有 296 个可解析技能均展示“效果摘要”。
摘要包含目标、武器、伤害属性、恢复配置及状态效果，状态解释直接使用
`AilmentData -> DiseaseData.Detail -> GameTextZH_CN` 的官方中文文本。
不套用同名习得技能或剧情角色技能的说明，它们的目标和回合数可能不同。
命中段数、动作脚本机制和最终数值公式仍以游戏内为准；不是完整游戏内技能
说明的逐字复刻。7 条没有可解析技能的 NPC 不显示技能占位符。

随行指令按存档中的实际 FieldCommandType 显示为引导、诱惑、雇佣、收服；
未知值仍显示数字，避免按角色猜测。空槽与未知 NPC 不生成右侧描述节点，
窄屏时也不预留第二行高度。数据库次数与无限标记分别标注，输入框仍显示
存档剩余次数。

导出命令：

```sh
node scripts/octopath-ii-follow-npcs.mjs --pak "$OT2_PAK_PATH" \
  --control "$OT2_CONTROL_PATH" \
  --out-dir src/lib/templates/octopath-traveler-ii/saveEditor/data
```

本次只运行以下定向验证：

```sh
node --test scripts/tests/octopath-ii-follow-npcs.unit.test.mjs
pnpm run check
```

结果：10 项通过；类型检查 0 错误、0 警告。组件采用 SSR 静态渲染验证，
没有运行浏览器端到端、全量回归或游戏内测试。字典生成时仅只读访问游戏
资产；存档写入继续使用原 GVAS writer，未修改其实现或原始样本。

本机默认 pnpm 包装器曾自动触发依赖安装，已恢复原 npm 依赖与版本，并移出
新增 pnpm 锁/工作区文件。检查实际使用本机 pnpm 10 的绝对路径及原 Node
路径执行，不再触发自动安装；未改 package.json、package-lock.json 或 .npmrc。
