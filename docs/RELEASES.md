# 桌面自动发布与免费更新

## 正式发布

`.github/workflows/release.yml` 对 main 的 push 自动运行，也可手动触发 main。整个发布流程串行分配版本，避免同一个版本并发发布；待执行任务可能合并为最新一次 push。

版本从 package.json 基础版本与已有正式版本标签中选择：基础版本更高时使用基础版本，否则递增已存在版本的补丁号。CI 仅为候选包写入版本，不提交版本回写，避免循环触发。失败产生的草稿标签也占用版本号；下一次选择新版本，不覆盖旧包。

自动发布仅测试并构建 Mac arm64，失败则停止公开发布。构建完成后，发布任务创建草稿、上传 arm64 的 DMG、ZIP 及 SHA256SUMS.txt，按 Release ID 确认全部附件的名称、大小、SHA-256 与本地产物一致，再按 ID 转为正式版并标记 latest；公开后才使用 tag 接口复核。流程由 `scripts/publish-release.mjs` 统一执行。失败的草稿保持不可作为最新正式版分发，不用部分包替代完整发布。

DMG 使用 HFS+ 文件系统；仅针对 hdiutil create 的 Resource busy 最多尝试 3 次，间隔 2 秒、5 秒。超时、其他错误及完整性或签名校验失败立即停止，不发布候选。

Mac 候选仍使用 ad-hoc 签名及现有 DMG 校验，不代表 Developer ID 签名或 Apple 公证。Windows 产物为安装器；运行与安装验收需在 Windows 执行。

`.github/workflows/build.yml` 保留 PR 的 Mac arm64 检查及手动构建；手动勾选 mac_intel 可增加 Intel 包，勾选 windows 可增加 Windows 安装包。main 自动发布不再构建这两个目标，避免等待未使用的平台。

## 免费更新路径

正式安装的应用启动 10 秒后检查 GitHub `/repos/koxinyu11/Dog-cow/releases/latest`，随后每 4 小时检查一次。设置 → 迁移备份 → 版本与更新可立即检查、查看下载进度、重试或打开安装包。

只接受更高的三段正式版本，拒绝草稿、预发布和回退版本。按当前系统、架构选择标准命名附件：

- `DogCow-arm64-VERSION.dmg`
- `DogCow-x64-VERSION.dmg`
- `DogCow-win32-x64-VERSION-setup.exe`

下载到应用用户数据目录的 updates 子目录。限定 HTTPS 和 GitHub 下载域，限制 metadata/安装包大小与连接时间，下载时计算 SHA-256 并检查确切大小；未通过校验的 .part 文件删除。缓存校验通过后可复用，打开安装包前再次检查散列。失败保留当前应用与业务数据，不替换正在运行的程序；用户可重试。下载不阻塞保存业务命令，同一时间只运行一个检查/下载任务。

自 v3.1.0 起，已安装在受支持目录的 Mac 正式版可由用户点击“安装并重启”：先保存有效草稿与本机数据，验证候选并备份，再正常退出，由独立助手替换和启动新版。保存失败或旧版未正常退出时停止；不强制终止进程。DMG 同时提供手动安装脚本，目标仍在运行时拒绝替换。开发实例不下载或执行正式版安装；v3.1.0 以前的版本仍使用原有的打开安装包入口手动完成首次升级。

最新自动 Release 只提供 Mac arm64；其他系统或架构检查时会提示暂无匹配安装包，不下载错误架构的包。

目前没有 Developer ID 签名；v3.1.0 的一键安装需用户主动点击，不会后台静默替换或重启。旧 `docs/appcast.xml`、`UPDATER_SETUP.md` 和 SPARKLE_ED_KEY 属于旧 WKWebView 壳，不用于新版 Electron。GitHub SHA-256 校验防止下载损坏，并不代替 Apple 签名或独立更新签名。

v3.0.0 没有这套更新链路，需手动安装一次包含本功能的新版本，后续可自动发现并下载新安装包。仓库 package.json 的基础版本与 CI 自动递增的发行版本可能不同，以已安装包的版本和 GitHub Release 为准。

## 验证边界

本地检查覆盖版本选择、版本分配、平台与架构匹配、无效/过期版本拒绝、并发去重、下载散列与大小、跳转域、下载失败重试、缓存复用及篡改检测。UI 体验由用户验收。工作流文件通过静态核对不等于远端真实运行；必须 push 后观察 Mac arm64 构建及最终公开 Release，才能确认自动发布链路成功。Mac/Windows 跨版本手动安装仍需用户验收。


## v3.0.5 发布与更新修复

- 自动发布不再使用已发布 tag 接口读取草稿；先按 Release ID 校验确切的三个附件及散列，再公开发布，最后检查 tag 与 latest。相同提交的完整草稿可继续；不同提交或附件不一致时保留原草稿并停止，不覆盖。
- Electron 的 net.fetch 在 manual 模式下会取消重定向，不能按 Node fetch 的 302 响应方式使用。下载专用适配器改用 net.request 暴露 redirect 事件，返回给更新器逐跳验证；metadata 保持 Chromium fetch，继续使用系统网络配置。
- Chromium 可能先发出 ClientRequest close、再发出 redirect/response，不能将 close 直接判成连接失败。失败由 error、abort、响应中断及超时定义；流式缓冲上限 8 MiB，避免磁盘写入积压无限占用内存。
- 保留文件大小、SHA-256、并发去重、缓存复验与 .part 清理。错误状态区分检查、下载、完整性校验，并记录关联标识；诊断不记录签名下载 URL 或用户数据。
- v3.0.2–v3.0.4 含旧下载实现。已安装旧版需要手动安装一次修正版，远端发布不能修改已运行程序的下载代码。替换 .app 不修改独立的 DogCow 数据目录；替换前先正常退出并备份。
