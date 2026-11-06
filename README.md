# 歧路旅人2／歧路旅人Ⅱ 中文存档修改器

Octopath Traveler II Save Editor · 八方旅人2 · 简体中文 · Switch / Steam

专门维护《歧路旅人2》（又称八方旅人2、歧路旅人Ⅱ / Octopath Traveler II）的浏览器存档编辑器。存档在本地浏览器处理，保存时下载副本。

## 功能

- 中文物品搜索、分类、装备与背包编辑，显示物品效果与标签。
- 角色状态、职业、技能与辅助技能编辑。
- 光的习得技能编辑、排序及实验性槽位扩容，剧情备份通过明确操作同步。
- 欧修缇捕获魔物与历战魔物编辑、技能说明、星级、加工产物及次数。
- 随行 NPC 与待命列表编辑、角色归属、中文指令、强度星级和技能效果说明。
- 保留未知 ID、特殊次数值与无关字段，支持 GVAS 存档读取和保存副本。
- 保留原有桌面与移动端界面样式、调试和文件查看功能。

实验性扩容能正确序列化，不代表游戏保证支持任意槽位数。先备份原存档，再在游戏中验证修改结果。

## 使用与开发

需要 Node.js 24，使用现有 npm 锁文件，不升级技术栈：

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run check
npm run test:unit
```

开发入口：`http://127.0.0.1:5173/octopath-traveler-ii/save-editor/`。
macOS 也可双击「启动八方旅人2中文版.command」，使用独立端口 18783，与旧项目互不影响。

```sh
BASE_PATH=/octopath-traveler-ii-save-editor-zh-cn SITE_ORIGIN=https://kokoro-o.github.io npm run build
BASE_PATH=/octopath-traveler-ii-save-editor-zh-cn npm run check:static
npm run audit:publication
```

构建输出为 `build/`，无需 Node 后端。个人存档、游戏包、环境变量和本地测试结果不得提交。
仓库只保留上游原样公开的 Steam 测试样本；Switch 个人样本可选放入 `.local/test-saves/MJSaveData2`，缺少时仅跳过该样本测试。

## 部署与维护

[部署步骤](docs/github-pages.md) · [迁移说明](docs/standalone-migration.md) · [中文使用说明](中文版使用说明.md)

新项目使用 `standalone` 分支、独立开发历史。原 Fork 及旧站继续保留；当前私人仓库是否公开、何时启用 Pages，单独确认后操作。README 中不把尚未部署的目标网址标成已上线。

## 项目来源与版权

基于 [RyudoSynbios/game-tools-collection](https://github.com/RyudoSynbios/game-tools-collection) 二次开发。
迁移基线为 [kokoro-o/game-tools-collection 的 b815f3e](https://github.com/kokoro-o/game-tools-collection/commit/b815f3e081d630308cc1419164feef77eed6b97d)。
在原有编辑器和 GVAS 实现基础上，本项目保留现有中文本地化、物品与角色功能扩展，并移除其他游戏工具。
完整旧历史在原项目及原 Fork 中查阅；新项目从已验证的单游戏版本开始记录后续开发。

保留 [原作者 MIT 许可证及版权声明](LICENSE.md)。第三方代码和字体见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
游戏名称、商标、图像与游戏文本归各自权利人所有，不因本仓库采用 MIT 而转为 MIT 授权。本项目为非官方工具，与游戏权利人无隶属关系。
