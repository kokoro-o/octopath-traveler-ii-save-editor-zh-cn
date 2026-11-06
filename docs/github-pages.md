# 将修改版发布到 GitHub Pages

当前版本保留上游完整工程和 MIT 声明。首页增加八方旅人 II 中文版入口，
其余游戏仍使用上游实现。GitHub 用户名已确认是 `kokoro-o`，以下按 Fork
保留仓库名 `game-tools-collection` 编写；若改名，把命令中的仓库名替换成新名称。

## 已准备的代码

- 使用 `@sveltejs/adapter-static`；构建结果是 `build/` 中的 HTML、JS、CSS、图片。
- 页面在浏览器运行，为所有现有游戏入口生成物理 `index.html`，直达和刷新不依赖后端路由。
- 日志 POST 接口已移除，文件打开的成功/失败仅输出本地控制台，不发送存档内容或统计请求。
- 仓库子路径通过 `BASE_PATH` 设置；导航、图片、图标和编辑器路由均使用该路径。
  SvelteKit 对应配置是 `kit.paths.base`，无需再向 Vite 重复添加 `base`。
- `.github/workflows/pages.yml` 会读取 Pages 的实际域名/路径，不需要手写用户名或申请访问令牌。
- 向 `master` 或 `main` 推送会触发审查、安装锁定依赖、类型检查、静态构建和部署。
- 本文保留首次 Fork 和部署的步骤；实际发布状态以仓库 Actions / Pages 为准。

准备阶段验证：按发布清单复制到不含 `.env`、本地提取报告或个人存档的独立
目录后，`npm ci`、类型检查、静态构建及产物检查均通过。原工作目录的
`pnpm check` 为 0 错误、0 警告。浏览器已验证仓库子路径首页、编辑器直达、
刷新、读取上游 Steam 样本和下载副本，无浏览器错误。未运行全量回归；
GitHub 云端工作流结果可在仓库 Actions 中查看。

## 1. 在网页创建自己的 Fork

1. 登录 [GitHub](https://github.com/)，确认右上角账号是 `kokoro-o`。
2. 打开 [原项目](https://github.com/RyudoSynbios/game-tools-collection)。
3. 点击右上角 **Fork → Create a new fork**。
4. Owner 选择自己的账号；Repository name 保留 `game-tools-collection`。
5. 可以勾选 **Copy the master branch only**，点击 **Create fork**。
6. 进入自己的仓库，地址应为 `https://github.com/kokoro-o/game-tools-collection`。

公开 Fork 会保留上游代码和历史；这不同于重新上传一个无来源的新仓库。

## 2. 让本地项目指向自己的仓库

在项目文件夹打开终端。先确认位置和分支：

```sh
pwd
git branch --show-current
git remote -v
```

如果本地项目从原作者仓库克隆，`origin` 会指向原作者。以下远程关联命令仅在首次设置时执行：

```sh
git remote rename origin upstream
git remote add origin https://github.com/kokoro-o/game-tools-collection.git
git remote -v
git fetch origin
```

此后 `origin` 是自己的仓库，`upstream` 是原作者的仓库。后续更新不要重复
执行 rename/add。如果已经存在这两个远程，只核对 URL。

如果需要登录，使用 GitHub Desktop / GitHub CLI 的网页登录认证或已有凭证
管理器。不要把令牌写进远程 URL、源码、`.env.example` 或终端截图。GitHub
账号密码不能代替 HTTPS Git 身份验证。

## 3. 本地检查、核对文件清单

先安装 Node.js 24。已安装依赖时无需重复安装：

```sh
node --version
npm ci --no-audit --no-fund
npm run check
npm run audit:publication
BASE_PATH=/game-tools-collection SITE_ORIGIN=https://kokoro-o.github.io npm run build
BASE_PATH=/game-tools-collection npm run check:static
```

`audit:publication` 会生成仅保存在本地的 `.local/publication-files.txt`。
用文本编辑器查看清单；不会自动提交或上传。

本地开发仍使用：

```sh
npm run dev -- --host 127.0.0.1
```

此时访问终端显示的本机地址，进入 `/octopath-traveler-ii/save-editor/`。
`BASE_PATH` 只在上面的构建命令内生效，不会永久改变系统环境变量。

## 4. 暂存并再次检查，再提交

以下清单包含当前功能修改、公共脚本、运行字典、部署配置和文档。
不添加 `build/`、`node_modules/`、`.local/` 或 `.env`。

```sh
git add -- .gitignore .env.example README.md LICENSE.md package.json package-lock.json svelte.config.js vite.config.ts src static scripts docs .github
git add -- 启动八方旅人2中文版.command 停止八方旅人2中文版.command 中文版使用说明.md
npm run audit:staged
git diff --cached --stat
git status --short
```

`.gitignore` 会排除新增个人存档、游戏包、密钥、机器专用测试配置、本地测试
输出和提取报告。上游仓库原有的公开测试样本已经在 Git 历史中，仍保留；
审查脚本只允许与指定上游提交完全相同的样本，不允许借该目录上传个人存档。
忽略规则不会删除已经存在的 Git 历史。

仓库中的运行字典仍包含编辑器必需的游戏名称/说明，图片也保留上游资源。
保留来源和 MIT 声明不代表取得了第三方游戏素材的所有权。审查脚本检查
文件路径、明显凭证和样本变更，不作第三方素材授权保证。

核对无误后，再执行下面两条实际发布源码的命令：

```sh
git commit -m "Publish static Octopath Traveler II editor with GitHub Pages"
git push -u origin master
```

如果 Git 首次提示没有作者信息，可只为当前仓库设置你自己的姓名和 GitHub
邮箱（也可以使用 GitHub Settings → Emails 中提供的 noreply 地址）：

```sh
git config user.name "你的 GitHub 显示名"
git config user.email "你的 GitHub 邮箱或 noreply 地址"
```

如果推送提示 non-fast-forward，先停止，不使用 `--force`。在自己的仓库
确认没有另加 README 等网页提交，再检查 `git log --oneline --graph --all`。

## 5. 在 GitHub 启用网站

1. 打开自己的仓库 → **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 如 Fork 的 Actions 被暂停，进入 **Actions**，启用自己的仓库工作流。
4. 在 Actions 选择 **Deploy static editor to GitHub Pages → Run workflow**，
   Branch 选择 `master`。第一次 Push 若因 Pages 尚未启用而失败，启用后重新运行即可。
5. 等 `build` 和 `deploy` 都变绿；部署任务会显示实际网站地址。

预计首页：[https://kokoro-o.github.io/game-tools-collection/](https://kokoro-o.github.io/game-tools-collection/)

预计编辑器直达：[https://kokoro-o.github.io/game-tools-collection/octopath-traveler-ii/save-editor/](https://kokoro-o.github.io/game-tools-collection/octopath-traveler-ii/save-editor/)

这两个地址在首次部署成功之前不会可用。发布只上传 `build/` 静态产物；
不上传本地测试输入，不需要常驻 Node 服务器，也不需要让 Mac 持续开机。

## 6. 以后更新

```sh
npm run check
npm run audit:publication
git add -- src scripts docs .github package.json package-lock.json svelte.config.js vite.config.ts README.md
npm run audit:staged
git diff --cached --stat
git commit -m "Describe the feature or fix"
git push
```

新增改动涉及其他文件时，把文件名加入 `git add`，并检查暂存内容。每次
推送到 `master` / `main` 后网站自动重新部署；构建失败时旧网站保持原版本。
网址不会因为普通功能更新而变化。修改仓库名称后，重新部署以更新子路径。

官方参考：[Fork 操作](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo)、
[Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、
[SvelteKit 静态适配器](https://svelte.dev/docs/kit/adapter-static)。
