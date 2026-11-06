<div align="center">

# 🐶 狗牛 🐮

### 班是要上的，草是要吃的，工资是要数的。

给打工狗和上班牛的桌面搭子：记待办、养小牛，顺便看看今天赚了几口草。

[![下载 Mac 版](https://img.shields.io/badge/下载_Mac_版-v3.0.16-56865b?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.16/DogCow-arm64-3.0.16.dmg)
[![所有版本](https://img.shields.io/badge/所有版本-Releases-343b36?style=for-the-badge&logo=github&logoColor=white)](https://github.com/koxinyu11/Dog-cow/releases)

[怎么安装](#下载安装) &nbsp; · &nbsp; [能做什么](#主要功能) &nbsp; · &nbsp; [最近更新](#最新版更新) &nbsp; · &nbsp; [常见问题](#常见问题) &nbsp; · &nbsp; [技术栈](#技术栈) &nbsp; · &nbsp; [隐私说明](#隐私说明)

</div>

<br>

## 下载安装

**Mac · Apple Silicon（M 系列芯片） · v3.0.16**

| 安装方式 | 下载 | 怎么装 |
| :--- | :--- | :--- |
| **DMG · 推荐** | [⬇ 下载 DMG](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.16/DogCow-arm64-3.0.16.dmg) | 打开镜像，将狗牛拖入 Applications，再从“应用程序”打开。 |
| ZIP | [⬇ 下载 ZIP](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.16/DogCow-darwin-arm64-3.0.16.zip) | 解压后，将狗牛.app 放入“应用程序”，双击打开。 |
| 文件校验 | [SHA256SUMS.txt](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.16/SHA256SUMS.txt) | 核对下载文件的 SHA-256 校验值。 |

> 本次仅提供 **Apple Silicon（arm64）** 安装包，暂不提供 Intel Mac 和 Windows 包。安装包采用本地测试签名，尚未完成 Apple Developer ID 签名和公证；若 macOS 阻止打开，请先确认来源，再查看“系统设置 → 隐私与安全性”的允许打开选项。

**旧版用户先备份：** 在原版本导出备份，再通过新版“设置 → 迁移备份”导入。确认导入结果前，请保留原应用和原数据。正式版会自动检查并下载更新，也可在“设置 → 迁移备份 → 版本与更新”中重试；下载完成后仍需手动安装。安装后从“应用程序”打开，并推出安装镜像。

<details>
<summary><strong>想从源码启动？</strong></summary>

安装 [Node.js](https://nodejs.org/)（建议 v24），然后在终端运行：

```sh
git clone https://github.com/koxinyu11/Dog-cow.git
cd Dog-cow
npm ci
npm run dev
```

已有旧版数据时，请先备份。新版与旧版不会自动共享数据，迁移步骤见[使用参考](docs/REFERENCE.md#数据与迁移)。

开发实例使用独立的 `DogCow-dev` 数据目录，不下载正式版更新。请用 `npm run dev` 启动，无需保留 `build/`、`out/` 中的旧打包应用。正式版与开发实例可以分别保留；遇到启动冲突时，不要为了启动开发版而强制关闭正式版。

</details>

## 主要功能

早上打开狗牛，把今天要啃的活儿列好。做完一件，小牛就离草地近一点；忙累了，看看收入时钟和下班倒计时——今天的草料，心里有数。

以下为当前正式版的主要功能。

| | 狗牛能帮你 | 怎么用 |
| :---: | :--- | :--- |
| 📝 | **把活儿赶进围栏** | 待办写下来，轻重缓急排一排；周计划和月历帮你看清哪天啃哪件。 |
| 🐮 | **你干活，小牛吃草** | 推一推任务进度，小牛就往草地走；当天任务全完成，撒花收工。 |
| 💰 | **数数今天的草料** | 填好薪资和工作时间，看每秒收入、今日与本月累计，再瞄一眼离下班还有多久。 |
| ☕ | **歇口气，也记一笔** | 上班、午休、下班点一下；忘打卡可以补，带薪、无薪请假也能记。 |
| 🎨 | **自己的工位自己摆** | 想看任务就摆任务，想看收入就摆收入；模块顺序、标题随你改，也能收成小横条。 |
| 🍱 | **午饭不再纠结** | 从 568 道菜中挑选午餐，或开个盲盒；卡片随尺寸调整布局。 |
| 🧾 | **记下老板欠的账** | 查看打卡对应的加班时间，补记处理消息的时间，并导出欠条 PNG；加班费需在收入设置中开启，默认关闭。 |
| 💾 | **小本本留在自己手里** | 任务和设置自动保存在本机，换版本前还能导出备份，给辛苦记下的事留个底。 |

<sub>工资换算卡片支持调整换算项目。收入与税费为估算；“偷出金额”是工作时间的价值拆分，不是额外工资。首页默认展示九类卡片，可调整大小、拖动排列或移除。</sub>

## Mac 菜单栏状态面板

菜单栏默认显示狗牛剪影，也可在“设置 → 外观 → 菜单栏”切换为今日收入或下班倒计时。点击入口可查看工作状态、今日/本月收入估算、已工作时长、任务完成度、下一项任务和盼头倒数日；更多盼头可展开，管理操作复用主窗口编辑器。

面板与主窗口可同时显示。关闭主窗口后继续后台常驻，再次点击菜单栏入口或在面板内按 Esc 收起面板；需要结束应用时使用面板的退出图标或 Cmd+Q。显示选择本地保存，面板跟随明暗主题并支持减少动态效果。

此功能自 v3.0.12 起包含在正式版中；实现范围与验证记录见[菜单栏计划归档](docs/feature-plans/implemented/menu-bar-status.md)。

## 打工人隐藏壁纸

新增 9 张隐藏壁纸，获得对应称号后出现在“设置 → 外观 → 背景”，带 ✨ 的会动：带薪下钱雨 ✨、奶茶自由 ✨、无理小金库、到点跑路 ✨、周五永居 ✨、周一免疫、需求粉碎机 ✨、资本家克星、终身股东 ✨。解锁条件不公开，靠打工自己发现。新获得称号时，解锁提示会一起列出新壁纸；升级前已有的称号对应壁纸直接可用，不再提示。关闭动效或系统减少动态效果时显示静态画面。自 v3.0.15 起包含在正式安装包中。

## 最新版更新

当前正式版为 **v3.0.16**，提供 Apple Silicon 的 DMG、ZIP 和 SHA-256 校验文件。以下按已发布标签及对应提交整理；测试和维护版本单独注明，历史平台支持不代表当前安装包范围。

### [v3.0.16](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.16) · 当前正式版

- 新增：在打卡卡片“更多 → 补录”或设置中的补录入口，选择日期补填、修改或删除午休时段；支持多段午休及仅记录午休的模式，保存后重算相关统计。时间冲突时保留原记录。
- 修复：更新下载请求统一使用 ASCII User-Agent，避免中文应用名导致安装包服务器返回 HTTP 400；保留下载来源及 SHA-256 校验。

<details>
<summary><strong>历史版本 · v3.0.15 及更早</strong></summary>

### [v3.0.15](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.15) · 隐藏壁纸

新增 9 张随称号解锁的隐藏壁纸，部分支持动态效果；已有称号对应壁纸升级后直接可用。

### [v3.0.14](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.14) · 样式修复

修复正式安装包在未开启“减少动态效果”时全局样式失效的问题。

### [v3.0.13](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.13) · 功能更新

新增“老板欠我钱”模块：根据打卡记录计算加班时间，支持补记处理消息的时间及导出欠条 PNG；收入设置新增加班费开关（默认关闭）、倍率与起算分钟。职称库增加静默解锁的“讨薪进度”系列。

午餐选择扩充为 568 道菜，加入盲盒及不同尺寸布局；重做工资换算卡片布局与控件。

### [v3.0.12](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.12) · 菜单栏状态面板

新增 Mac 菜单栏状态面板，可查看工作状态、收入、任务和倒计时，并调整展示内容。

### [v3.0.11](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.11) · 盼头倒计时

盼头倒计时支持重复、预设及不同尺寸的卡片布局。

### [v3.0.10](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.10) · 问题修复

修复了一些已知问题。

### [v3.0.9](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.9) · 带薪如厕卡片

按卡片尺寸调整布局，并更新如厕计时按钮动效。

### [v3.0.8](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.8) · 称号与收藏

新增荒诞职场称号、隐藏解锁条件和称号仓库。

### [v3.0.7](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.7) · 仓库维护

将 agent 协作规则保留在本地；没有新增用户功能。

### [v3.0.6](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.6) · 带薪如厕

新增带薪如厕计时；补充正式安装版实例保护规则，避免开发操作影响正式版。

### [v3.0.5](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.5) · 更新下载与发布修复

修复 Electron 下载 GitHub 安装包时的跳转处理；发布草稿改为按 ID 核验与公开，检查产物和目标提交，并区分检查、下载与校验阶段的错误。

### [v3.0.4](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.4) · 桌面数据胶囊

新增 240×32 紧凑数据胶囊，可显示收入、下班倒计时、任务完成度等指标；支持置顶、拖动、右键菜单和窗口偏好恢复。展开、收起以右上角为锚点，配色跟随主题与明暗模式，并优化过渡动画。

### [v3.0.2](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.2) · 趣味卡片、计薪与应用内下载

相较 3.0.0，新增趣味卡片、可解锁心情壁纸、下班倒计时和收工小票；支持模块内容编辑、按日灵活打卡及独立年终奖税费计算。餐食可手动填写，热量按份量估算并支持调整、恢复自动估算，修复模块裁切。加入自动检查、下载安装包能力，安装仍需手动完成；改进 Mac 打包重试与发布版本处理。

### [v3.0.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.0) · Electron 桌面版

迁移到 Electron、React 和 TypeScript；首页改为可拖动、调大小和移除的九类模块。新增浅色、暗黑、自动模式，以及包月、按天计薪和税前月薪估算开关；调整每日收入、下班补齐及偷出金额口径，统一表单样式并修复卡片裁切。旧原生版数据需通过备份迁移。

### [v2.8.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.8.0) · 紧凑标题栏

新增紧凑标题栏模式。

### [v2.7.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.7.0) · 未完成任务顺延

支持将未完成任务顺延到下一天。

### [v2.6.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.6.0) · 复用标签与公开更新

新增可复用标签，并支持通过公开发布源进行 Sparkle 更新。

### [v2.5.5](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.5) · 更新链路验证

准备最终一轮更新测试，并维护更新源；没有新增业务功能。

### [v2.5.4](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.4) · 更新缓存修复

按应用版本隔离 Sparkle 更新源缓存，避免不同版本共用缓存影响更新检查。

### [v2.5.3](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.3) · 更新链路验证

准备经核验的更新测试版本，并维护更新源；没有新增业务功能。

### [v2.5.2](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.2) · 更新版本匹配修复

对齐应用包版本与 Sparkle 更新源版本。

### [v2.5.1](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.1) · 更新链路验证

准备 2.5.1 更新测试版本，并维护更新源；没有新增业务功能。

### [v2.5.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.5.0) · Sparkle 更新接入

原生 Mac 版接入 Sparkle 应用内更新，补齐更新签名流程与构建公钥配置；仓库新增限定范围的自动同步脚本。

### [v2.4.1](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.4.1) · 下载产物修复

统一发布附件名称，保持下载资源命名稳定。

### [v2.4.0](https://github.com/koxinyu11/Dog-cow/releases/tag/v2.4.0) · 原生 Mac 版

提供周任务、月历和历史记录；支持单项与整周任务创建，以及时间、优先级、标签、备注和进展。提供 Apple Silicon / Intel 通用安装包，并支持当时的私有 GitHub 发布源更新检查。

> 发布记录中没有独立的 v3.0.1、v3.0.3 标签，相关已发布改动归入实际包含它们的版本。

</details>

## 技术栈

v3.0.2 采用以下技术：

| 层级 | 技术 |
| :--- | :--- |
| 桌面应用 | Electron |
| 界面开发 | React + TypeScript |
| 构建工具 | Vite + Electron Forge |
| 图标 | Lucide React |
| 业务与存储 | JavaScript / TypeScript，本地 JSON 文件保存 |

## 隐私说明

以下说明依据当前仓库源码中的存储、网络与权限实现。

- **数据留在本机**：任务、薪资、考勤和设置保存在本机文件中；当前未提供账号系统或云同步，未接入使用行为统计或广告追踪。
- **联网用途明确**：中国调休日历会从 GitHub / jsDelivr 获取对应年份的公共日历，请求不附带你的任务、薪资或考勤数据。点击发布页或政策来源链接时，会交由系统浏览器打开，对方网站会接收到正常访问请求。
- **更新检查与下载**：正式版启动后会检查 GitHub Releases，并定期检查新版本；发现适配安装包时自动下载，安装前校验大小与 SHA-256。请求不附带任务、薪资或考勤数据，安装仍由你手动完成。
- **备份由你保管**：导出和迁移在本机进行，不会自动上传。数据和备份采用 JSON 格式，未做应用层加密，请勿将包含个人信息的文件公开分享。
- **界面权限隔离**：桌面界面启用上下文隔离与沙箱，关闭 Node.js 直接访问，通过受控接口读写业务数据。
- **卸载与删除分开**：删除应用不会自动清除本机数据。Mac 正式版数据位于 `~/Library/Application Support/DogCow/`，开发版位于 `~/Library/Application Support/DogCow-dev/`；需要清除时，请先退出应用并确认备份，再删除对应目录及自行导出的备份文件。
- **反馈前先脱敏**：提交截图或日志前，请隐藏薪资、任务内容和个人路径；无需提供完整个人数据文件。

## 常见问题

<details>
<summary><strong>下载链接打不开，或者下载失败怎么办？</strong></summary>

可以从 [Releases 页面](https://github.com/koxinyu11/Dog-cow/releases) 展开对应版本的 Assets，选择 `DogCow-arm64-3.0.16.dmg` 或 `DogCow-darwin-arm64-3.0.16.zip`。下载中断时请重新下载并完整解压，仍有问题可在 Issues 反馈。

</details>

<details>
<summary><strong>为什么电脑上出现多个“狗牛”图标？哪些可以清理？</strong></summary>

macOS 可能同时识别“应用程序”中的正式版、挂载安装镜像中的应用、源码目录 `build/` 和 `out/` 内的打包产物，以及 `~/Library/Application Support/DogCow-app-backups/` 内的旧应用备份。它们名称和图标相同，多个图标不代表同时运行了多个实例。

- 日常使用保留 `/Applications/狗牛.app`，从“应用程序”启动；版本可在设置中核对。
- 完成安装后推出“狗牛”磁盘镜像；不再需要的旧 DMG、ZIP、旧构建和旧应用备份可移到废纸篓。先核对路径、版本，并确认该副本没有运行；迁移尚未核对完成时保留旧版备份。
- 开发时保留源码与依赖，通过 `npm run dev` 启动；旧打包产物并不是开发实例所必需的文件。
- 清理应用副本时，不要删除 `DogCow/`、`DogCow-dev/` 业务数据目录或个人导出的数据备份。正式包实例不要为清理或开发验收而强制退出。

</details>

<details>
<summary><strong>Mac 提示无法验证开发者、应用已损坏或无法打开？</strong></summary>

先确认文件来自本仓库，并重新下载、完整解压。“无法验证开发者”时，可查看“系统设置 → 隐私与安全性”是否提供允许打开选项。若仍无法打开，请反馈 Mac 芯片、macOS 版本和完整提示，不需要关闭系统整体安全保护。

</details>

<details>
<summary><strong>支持 Windows 和 Intel Mac 吗？</strong></summary>

当前 v3.0.16 只提供 Apple Silicon（M 系列芯片）的 Mac 安装包。Intel Mac 与 Windows 安装包暂未发布，请勿下载 arm64 包用于这些设备。

</details>

<details>
<summary><strong>旧版怎么升级到 3.0？</strong></summary>

先在旧版导出备份，再下载安装 v3.0.16，通过“设置 → 迁移备份”导入并核对结果。新旧版本数据不会自动互通；确认迁移成功前，保留旧应用和原数据。当前未启用自动安装更新。

</details>

<details>
<summary><strong>新版首页没有收入、工时和打卡卡片，在哪里打开？</strong></summary>

v3.0.2 默认展示九类卡片；“热量爆表”等附加卡片可从模块库加入。隐藏或移除卡片不会清除对应数据。

</details>

<details>
<summary><strong>收入金额和工资条不一样，“偷出金额”会额外加到工资里吗？</strong></summary>

收入根据你填写的薪资、排班、午休和请假等设置估算，税费参数也可能与实际工资条不同，请先核对设置。“偷出金额”只是固定收入中对应时间的价值，不会额外增加工资；最终收入以实际工资条为准。

</details>

<details>
<summary><strong>数据保存在哪里？更新后会自动同步吗？</strong></summary>

v3.0.2 的任务与设置自动保存在本机，支持备份和导入。旧版、浏览器预览与新版的数据不会自动互通，换设备或切换大版本前请先备份，再按[迁移步骤](docs/REFERENCE.md#数据与迁移)操作。若提示未保存，请先重试保存，再退出应用。

</details>

<details>
<summary><strong>遇到问题，反馈什么信息？</strong></summary>

在 [Issues](https://github.com/koxinyu11/Dog-cow/issues) 提供应用版本、系统版本、芯片型号、操作步骤和完整错误提示。截图或日志分享前，请遮住个人任务、薪资等隐私信息。

</details>

---

<div align="center">

[下载应用](https://github.com/koxinyu11/Dog-cow/releases) &nbsp; · &nbsp; [反馈问题](https://github.com/koxinyu11/Dog-cow/issues)

</div>
