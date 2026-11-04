<div align="center">

# 🐶 狗牛 🐮

### 班是要上的，草是要吃的，工资是要数的。

给打工狗和上班牛的桌面搭子：记待办、养小牛，顺便看看今天赚了几口草。

[![下载 Mac 版](https://img.shields.io/badge/下载_Mac_版-v3.0.1-56865b?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.1/DogCow-arm64-3.0.1.dmg)
[![所有版本](https://img.shields.io/badge/所有版本-Releases-343b36?style=for-the-badge&logo=github&logoColor=white)](https://github.com/koxinyu11/Dog-cow/releases)

[怎么安装](#下载安装) &nbsp; · &nbsp; [能做什么](#主要功能) &nbsp; · &nbsp; [最近更新](#最新版更新) &nbsp; · &nbsp; [常见问题](#常见问题) &nbsp; · &nbsp; [技术栈](#技术栈) &nbsp; · &nbsp; [隐私说明](#隐私说明)

</div>

<br>

## 下载安装

**Mac · Apple Silicon（M 系列芯片） · v3.0.1**

| 安装方式 | 下载 | 怎么装 |
| :--- | :--- | :--- |
| **DMG · 推荐** | [⬇ 下载 DMG](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.1/DogCow-arm64-3.0.1.dmg) | 打开镜像，将狗牛拖入 Applications，再从“应用程序”打开。 |
| ZIP | [⬇ 下载 ZIP](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.1/DogCow-darwin-arm64-3.0.1.zip) | 解压后，将狗牛.app 放入“应用程序”，双击打开。 |
| 文件校验 | [SHA256SUMS.txt](https://github.com/koxinyu11/Dog-cow/releases/download/v3.0.1/SHA256SUMS.txt) | 核对下载文件的 SHA-256 校验值。 |

> 本次仅提供 **Apple Silicon（arm64）** 安装包，暂不提供 Intel Mac 和 Windows 包。安装包采用本地测试签名，尚未完成 Apple Developer ID 签名和公证；若 macOS 阻止打开，请先确认来源，再查看“系统设置 → 隐私与安全性”的允许打开选项。

**旧版用户先备份：** 在原版本导出备份，再通过新版“设置 → 迁移备份”导入。确认导入结果前，请保留原应用和原数据。当前更新需手动下载。

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

</details>

## 主要功能

早上打开狗牛，把今天要啃的活儿列好。做完一件，小牛就离草地近一点；忙累了，看看收入时钟和下班倒计时——今天的草料，心里有数。

以下为 v3.0.1 功能。

| | 狗牛能帮你 | 怎么用 |
| :---: | :--- | :--- |
| 📝 | **把活儿赶进围栏** | 待办写下来，轻重缓急排一排；周计划和月历帮你看清哪天啃哪件。 |
| 🐮 | **你干活，小牛吃草** | 推一推任务进度，小牛就往草地走；当天任务全完成，撒花收工。 |
| 💰 | **数数今天的草料** | 填好薪资和工作时间，看每秒收入、今日与本月累计，再瞄一眼离下班还有多久。 |
| ☕ | **歇口气，也记一笔** | 上班、午休、下班点一下；忘打卡可以补，带薪、无薪请假也能记。 |
| 🎨 | **自己的工位自己摆** | 想看任务就摆任务，想看收入就摆收入；模块顺序、标题随你改，也能收成小横条。 |
| 💾 | **小本本留在自己手里** | 任务和设置自动保存在本机，换版本前还能导出备份，给辛苦记下的事留个底。 |

<sub>收入与税费为估算；“偷出金额”是工作时间的价值拆分，不是额外工资。首页默认展示九类卡片，可调整大小、拖动排列或移除。</sub>

## 最新版更新

### v3.0.1 · 已发布

这一版让工位更好改、更好收，也更懂午饭：

- **点图标改内容**：点击每个模块左上角图标，会打开该模块的独立内容编辑窗口，不再把图标本身当作修改项。
- **一键收成长条**：窗口右上角新增收起按钮，缩成只显示“狗牛”的横条，需要时再一键展开。
- **新增“热量爆表”**：可从模块库加入，与“今天吃什么”联动；确认餐食后自动显示常见单人份的估算热量。
- **旧数据继续可用**：任务、排班、工资、卡片布局和已有趣味模块数据格式保持兼容。

[查看完整发布说明](https://github.com/koxinyu11/Dog-cow/releases/tag/v3.0.1)

## 技术栈

v3.0.1 采用以下技术：

| 层级 | 技术 |
| :--- | :--- |
| 桌面应用 | Electron |
| 界面开发 | React + TypeScript |
| 构建工具 | Vite + Electron Forge |
| 图标 | Lucide React |
| 业务与存储 | JavaScript / TypeScript，本地 JSON 文件保存 |

## 隐私说明

以下说明针对当前 v3.0.1 源码实现。

- **数据留在本机**：任务、薪资、考勤和设置保存在本机文件中；当前未提供账号系统或云同步，未接入使用行为统计或广告追踪。
- **联网用途明确**：中国调休日历会从 GitHub / jsDelivr 获取对应年份的公共日历，请求不附带你的任务、薪资或考勤数据。点击发布页或政策来源链接时，会交由系统浏览器打开，对方网站会接收到正常访问请求。
- **备份由你保管**：导出和迁移在本机进行，不会自动上传。数据和备份采用 JSON 格式，未做应用层加密，请勿将包含个人信息的文件公开分享。
- **界面权限隔离**：桌面界面启用上下文隔离与沙箱，关闭 Node.js 直接访问，通过受控接口读写业务数据。
- **卸载与删除分开**：删除应用不会自动清除本机数据。Mac 正式版数据位于 `~/Library/Application Support/DogCow/`，开发版位于 `~/Library/Application Support/DogCow-dev/`；需要清除时，请先退出应用并确认备份，再删除对应目录及自行导出的备份文件。
- **反馈前先脱敏**：提交截图或日志前，请隐藏薪资、任务内容和个人路径；无需提供完整个人数据文件。

## 常见问题

<details>
<summary><strong>下载链接打不开，或者下载失败怎么办？</strong></summary>

可以从 [Releases 页面](https://github.com/koxinyu11/Dog-cow/releases) 展开对应版本的 Assets，选择 `DogCow-arm64-3.0.1.dmg` 或 `DogCow-darwin-arm64-3.0.1.zip`。下载中断时请重新下载并完整解压，仍有问题可在 Issues 反馈。

</details>

<details>
<summary><strong>Mac 提示无法验证开发者、应用已损坏或无法打开？</strong></summary>

先确认文件来自本仓库，并重新下载、完整解压。“无法验证开发者”时，可查看“系统设置 → 隐私与安全性”是否提供允许打开选项。若仍无法打开，请反馈 Mac 芯片、macOS 版本和完整提示，不需要关闭系统整体安全保护。

</details>

<details>
<summary><strong>支持 Windows 和 Intel Mac 吗？</strong></summary>

v3.0.1 本次只提供 Apple Silicon（M 系列芯片）的 Mac 安装包。Intel Mac 与 Windows 安装包暂未发布，请勿下载 arm64 包用于这些设备。

</details>

<details>
<summary><strong>旧版怎么升级到 3.0？</strong></summary>

先在旧版导出备份，再下载安装 v3.0.1，通过“设置 → 迁移备份”导入并核对结果。新旧版本数据不会自动互通；确认迁移成功前，保留旧应用和原数据。当前未启用自动安装更新。

</details>

<details>
<summary><strong>新版首页没有收入、工时和打卡卡片，在哪里打开？</strong></summary>

v3.0.1 默认展示九类卡片；“热量爆表”等附加卡片可从模块库加入。隐藏或移除卡片不会清除对应数据。

</details>

<details>
<summary><strong>收入金额和工资条不一样，“偷出金额”会额外加到工资里吗？</strong></summary>

收入根据你填写的薪资、排班、午休和请假等设置估算，税费参数也可能与实际工资条不同，请先核对设置。“偷出金额”只是固定收入中对应时间的价值，不会额外增加工资；最终收入以实际工资条为准。

</details>

<details>
<summary><strong>数据保存在哪里？更新后会自动同步吗？</strong></summary>

v3.0.1 的任务与设置自动保存在本机，支持备份和导入。旧版、浏览器预览与新版的数据不会自动互通，换设备或切换大版本前请先备份，再按[迁移步骤](docs/REFERENCE.md#数据与迁移)操作。若提示未保存，请先重试保存，再退出应用。

</details>

<details>
<summary><strong>遇到问题，反馈什么信息？</strong></summary>

在 [Issues](https://github.com/koxinyu11/Dog-cow/issues) 提供应用版本、系统版本、芯片型号、操作步骤和完整错误提示。截图或日志分享前，请遮住个人任务、薪资等隐私信息。

</details>

---

<div align="center">

[下载应用](https://github.com/koxinyu11/Dog-cow/releases) &nbsp; · &nbsp; [反馈问题](https://github.com/koxinyu11/Dog-cow/issues)

</div>
