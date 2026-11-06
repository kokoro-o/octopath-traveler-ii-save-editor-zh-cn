# 独立项目部署

仓库：`kokoro-o/octopath-traveler-ii-save-editor-zh-cn`，独立分支：`main`。
不修改旧 Fork `kokoro-o/game-tools-collection`、原工作目录或旧站。

## 1. 在本地验收

```sh
npm ci
npm run check
npm run test:unit
npm run audit:publication
BASE_PATH=/octopath-traveler-ii-save-editor-zh-cn SITE_ORIGIN=https://kokoro-o.github.io npm run build
BASE_PATH=/octopath-traveler-ii-save-editor-zh-cn npm run check:static
```

使用独立端口预览，避免影响旧服务：

```sh
BASE_PATH=/octopath-traveler-ii-save-editor-zh-cn npm run preview -- --host 127.0.0.1 --port 5188 --strictPort
```

打开 `http://127.0.0.1:5188/octopath-traveler-ii-save-editor-zh-cn/octopath-traveler-ii/save-editor/`。

## 2. 推送新分支

先在 GitHub CLI 完成账号认证：`gh auth login --web --git-protocol https`。
如需通过 HTTPS 推送，运行 `gh auth setup-git`。不在聊天或命令参数中填写访问令牌。

```sh
git branch --show-current
git remote -v
git ls-remote --heads origin main
```

最后一个命令应无输出；如存在同名分支，停止并核对其内容。
确认 origin 是上述私人独立仓库后再运行：

```sh
git push -u origin main
```

不使用 `--force`。首次迁移从本地 standalone 推送到远程 main：`git push -u origin standalone:main`，切换远程默认分支后，按所有者要求删除旧分支和标签。新分支根提交没有上游父提交。
本地分支名仍为 standalone 时，后续推送使用 `git push origin HEAD:main`，或先执行 `git branch -m main` 统一名称。

## 3. 单独确认公开范围与 Pages

当前账号的私人仓库 Pages 页面显示需升级或公开仓库。
GitHub Free 的 Pages 支持公开仓库；私人仓库需符合付费套餐要求。

改为 Public 会公开整个仓库的分支、历史等内容，不限于 main 分支。
公开前必须检查现有旧分支与历史中的私密内容，取得仓库所有者确认；不能仅依据新分支的文件审查就公开旧分支。
可以先保持 Private 推送和验证构建。工作流在 Private 状态只构建及上传静态产物，跳过部署。

确认公开范围后，在 GitHub 仓库 Settings → General 修改默认分支为 main；
需要公开时再执行 Change repository visibility，并在 Settings → Pages 将 Source 设为 GitHub Actions。
随后在 Actions 中重新运行工作流。若改为支持私人 Pages 的套餐，应同步调整 deploy job 的 Private 条件。

目标首页（部署后生效）：https://kokoro-o.github.io/octopath-traveler-ii-save-editor-zh-cn/

目标编辑器：https://kokoro-o.github.io/octopath-traveler-ii-save-editor-zh-cn/octopath-traveler-ii/save-editor/

工作流保留现有 SvelteKit 静态构建方式，按仓库名设置 BASE_PATH。
新站通过读取、修改、导出与重新导入验收前，保持旧站和旧仓库设置不变。

## 4. 后续更新

```sh
git switch main
npm run check
npm run test:unit
npm run audit:publication
git add <本次修改的文件>
npm run audit:staged
git commit -m "说明本次改动"
git push
```

仅向 main 推送触发本项目工作流。构建失败时排查 Actions 日志，不覆盖旧站。
修改仓库名或使用自定义域名时，应重新检查 BASE_PATH、SITE_ORIGIN 和所有静态入口。
