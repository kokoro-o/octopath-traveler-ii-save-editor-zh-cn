# 单游戏独立迁移记录（2026-11-06）

## 仓库与版本检查

复用现有 `kokoro-o/octopath-traveler-ii-save-editor-zh-cn`，不新建仓库。
检查时它是 Private，默认分支 master，提交为 `9fd7ee937a3b3e57f8a17cb958d2c20162b50cdd`。
该提交相对上游 `15d71340c3f1717745139c2e0774510cd37dfbdd` 领先 1 个提交、落后 0 个提交；20 个变化文件的 blob 与本地早期中文提交 `80a45f3` 对应文件逐一相同。

它是早期中文版本，尚未包含后续的物品浏览、技能、捕获魔物、随行 NPC 和静态 Pages 发布完整实现。因此可以复用仓库，但不能直接把旧 master 当作最新功能基线。

另有 castle-of-illusion-md、grandia、svelte-5-tailwindcss-4、three-loading-improvements、various 五个分支，检查时分支头与上游对应分支相同。
未发现这些分支中有当前稳定版缺失的私人独有功能；这项版本比较不等于对其全部历史做过隐私审计。

迁移基线使用原 Fork 的稳定提交 `b815f3e081d630308cc1419164feef77eed6b97d`。
原 Fork、原目录、原线上站点均不修改。

## Git 历史选择

| 方案 | 收益 | 代价与限制 |
| --- | --- | --- |
| 完整继承原历史 | 可在单仓库 blame、bisect 上游所有旧变更 | 引入大量其他游戏历史和夹杂维护记录；并非未来维护单游戏的必要条件 |
| 从稳定版建立独立根提交（采用） | 新开发历史清楚、克隆更小，不需要 filter-repo 或重写旧远程 | 上游旧 blame/bisect 需到原 Fork 查询，后续上游修复通常手动移植 |

原 Fork 保留作为旧历史来源。版权不依赖 Git 父提交：保留 LICENSE.md、原注释、来源链接与第三方声明。

在新本地目录建立 standalone 分支：根提交只包含单游戏工程；下一提交记录公共代码和依赖清理。首次检查阶段未推送远程；后续按所有者明确指示，将本地 standalone 推送到远程 main，设置 main 为默认分支，再删除 6 个旧分支和全部旧标签；不使用强制推送。
现有 master 与其他分支保留时，仓库整体仍有旧历史；如以后希望彻底移除，应另行归档并确认删除，不能混同于新分支无上游父提交。

## 两轮精简

第一轮：

- 仅保留 `src/lib/templates/octopath-traveler-ii/`，移除其他游戏模板、页面、图片和存档样本。
- 保留实际使用的通用输入、Items、文件查看器、调试栏、状态管理和 GVAS。
- 仅生成当前游戏的编辑器路由；保留首页、FAQ、关于与原编辑界面样式。
- 保留全部原有公共依赖及其版本，先通过类型、定向单元和静态构建检查。

第二轮：

- 根据引用移除 ModelViewer、SpriteSelector、独立 Explorer 组件、GameTile、canvas/three 和无引用公共工具；保留主状态重置使用的 explorer store。
- 保留运行依赖 file-saver、hex2dec、long、moment、throttle-debounce，以及现有 SvelteKit、Svelte、Vite、TypeScript 等开发构建依赖。
- 移除 7 个 @pixi 包，以及 js-md5、jszip、lil-gui、lz-string、pako、rijndael-js、three；移除对应 3 个无引用类型依赖。
- 不升级任何保留包的锁定版本；当前锁文件中 354 个剩余包版本与基线相同。
- 发布检查改为校验唯一上游公开 Steam 样本的固定 SHA-256，不再依赖上游 Git 提交存在。
- `.local`、个人 Switch 样本、导出副本、原始游戏资源与本机专用配置继续忽略。
- macOS 新启动器使用独立服务名和 18783 端口；预览用独立 5188 端口。

## 验证与边界

两轮均通过类型检查、静态构建与定向单元测试；未跑全量 E2E 或多游戏回归。
第一轮、第二轮各 79 项定向单元测试通过；其中包含本机 Switch 副本与上游 Steam 样本的完整 GVAS 往返。
39 个受保护文件 SHA-256 不变；全部 30 个游戏文件和 3 个 GVAS 文件与稳定版逐字节相同，包含中文字典、未知 ID 与交互逻辑。

最终 `pnpm check` 为 0 错误、0 警告；生产构建使用独立仓库子路径，静态入口检查通过。
浏览器定向验证：首页直达编辑器；读取 Switch 副本；葡萄数量 34→35；光习得技能从 5→6 槽并填入 1001；魔物次数改为 99 并移动整条记录；随行 NPC 次数改为 99。
导出后重新导入，以上值全部保留，浏览器无 error/warn。

原工作目录提交和工作区保持不变；旧编辑器公网入口检查返回 HTTP 200。
本地验证不能代替新仓库的 GitHub Actions、Pages 真正部署和游戏内测试，后两者尚未完成。

## 版权与发布前待确认

原 MIT 许可证原文不变；补充第三方许可、字体声明与网站可访问的许可证文件。
原有 DataView 扩展所链接的 Gist 仅对浮点读写部分明确列出 Joyent MIT，未查到覆盖其所有代码的明确许可。现阶段保留原来源注释并记录这一上游既有授权不确定性；不能据此宣称所有片段已完成法律意义上的权利核验。
游戏图像与文本的权利不随代码 MIT 许可证转移。

初次本地验收时 GitHub CLI 未认证，因此尚未上传；后续通过正常 Git 认证推送无父根历史，远程分支命名为 main。

私人仓库的 Pages 设置页要求升级套餐或公开仓库。当前工作流在 Private 状态仅验证构建，跳过部署。公开会暴露整个仓库的旧分支与历史，需先完成其公开范围检查并由仓库所有者确认。
上述为本地验收阶段的状态；后续已获授权接管 main、清除旧分支和标签并更新元信息。可见性仍保持 Private，Pages 公开部署另行确认。

## 仓库展示建议（待发布时设置）

名称继续使用 `octopath-traveler-ii-save-editor-zh-cn`。

Description：歧路旅人2／歧路旅人Ⅱ／八方旅人2 中文存档修改器 · Octopath Traveler II Save Editor · Switch / Steam · 浏览器本地处理

Topics：`octopath-traveler-ii`、`octopath-traveler-2`、`save-editor`、`savegame-editor`、`chinese`、`zh-cn`、`sveltekit`、`nintendo-switch`、`steam`。
中文关键词放在 Description 和 README；Topics 使用 GitHub 接受的英文小写标签。
README 已覆盖中文别名与英文全称。Private 状态不会让所有人搜索到仓库，公开后也不保证即时索引或排名。

## main 发布调整

工作流 push 监听改为 main，以匹配远程主分支；当前本地准备分支仍叫 standalone。无需重跑游戏功能测试或旧历史审计。
