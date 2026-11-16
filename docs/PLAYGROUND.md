# 本地游乐场接入约定（未发布）

游乐场是同一狗牛进程内的独立普通窗口：不绑定主窗口，不置顶，不影响主窗口收成胶囊；关闭时销毁，重复打开复用同一窗口。窗口位置与尺寸仅在本次应用运行期间保留。

## 文件与职责

- `src/main/playground-controller.ts`：原生窗口生命周期、来源校验、加载/崩溃诊断和主题推送。
- `src/preload/playground.cts`、`src/shared/playground.ts`：bootstrap、ready、主题订阅、受限的诊断上报/查询/复制，以及钓鱼专用命令。不能调用主窗口业务桥接。
- `src/renderer/playground.html`、`playground.tsx`：独立 Vite 页面与入口，不启动主应用 store。
- `src/renderer/features/playground/registry.ts`：轻量本地目录，不静态导入游戏实现。
- `GameHost.tsx`：按需加载、单游戏挂载、失焦暂停、手动继续、重开、异常与返回大厅。

这不是第三方插件安全沙箱：游戏和宿主在同一渲染进程中运行，都是经过审查的本地代码。不要将任意外部 HTML、脚本或远程游戏装入其中。同源页面的 Web 存储也不构成游戏隔离边界。CPU 密集计算应单独评估 Web Worker，宿主额外采集 error/unhandledrejection，但无法恢复死循环，也无法保证捕获系统强制结束、断电等情况。

## 添加一个游戏

1. 在 `games/<stable-id>/` 下增加游戏组件，默认导出接受 `GameProps` 的组件。
2. 在 `registry.ts` 的 `games` 数组增加 `id/title/description/icon/category/load`。`load` 使用显式 `() => import('./games/<stable-id>')`；标题可以修改，ID 保持稳定且唯一。
3. 游戏负责自己的规则和临时状态，不导入主应用 `state.ts`、Electron 或主应用业务模块。
4. 游戏必须响应 `paused`：停止操作、游戏计时、动画循环及声音。失焦/最小化后不自动继续。计时按经过时间计算，不能以定时器调用次数作为真实经过时间。
5. 游戏卸载时清除所有事件监听、RAF、定时器、音频与 Worker；React StrictMode 下重复挂载仍能正常清理。
6. 键盘操作只在游戏区域获得焦点且未暂停时处理。不要劫持应用快捷键，不全局改写 body 或共享 UI 样式。
7. 事件、定时器和 Promise 回调用 `diagnostics.guard('event' | 'timer' | 'promise', callback)` 绑定本局上下文；已自行处理的错误用 `diagnostics.capture(error, stage)` 明确上报。guard 记录后仍会重新抛出，不吞异常；同一 Error 对象经全局捕获时复用编号。全局无法确定所属局的异常标为未归属，不自动归给下一局。
8. 验证最小窗口、浅色/深色、减少动态效果、键盘导航，以及进入→暂停→继续→重开→返回→再次进入的行为。
9. README 更新到“未发布”；有算法规则的游戏增加有意义的规则测试。

布局约定：打开游戏后，宿主把标题栏与「大厅 / 重新开始 / 暂停」合并为顶部一条，游戏获得其下方全部宽高（`flex: 1`、`min-height: 0`）。游戏根节点应 `height: 100%` 铺满容器，自行决定内容居中或铺满；不要假设固定宽高比或外框。

已接入首款游戏 `desk-fishing`。独立测试游戏继续覆盖宿主生命周期与诊断链路。宿主重开会重新挂载组件；钓鱼通过专用主进程命令恢复存档与当前竿，重新等待但不重新抽取结果。其他游戏没有自动获得存档能力。

## 钓鱼存档与钱包

- `src/shared/fishing.ts`：商品、鱼种、规则、存档校验与受限返回类型；新增鱼种/商品在此维护。
- `src/main/fishing.ts`：装备、鱼篓、图鉴和每竿结果的主进程状态变更；`dogcow.fishing.v1` 与钱包共用 `Repository` 快照。
- 游戏专用 `window.playground.fishing()` 只允许白名单命令，原生窗口来源校验保持不变；不能访问业务桥接、路径或任意存储键。
- 所有钓鱼操作进入现有业务队列，服务端计算价格与随机结果；抛竿时保存隐藏结果，界面只获得信号和等待时长。重进、重开不会重新抽结果。
- 操作编号保留最近 128 项；收线额外校验当前竿 ID。购买扣币/加装备、出售扣收获/加币共用一次快照落盘，保存成功才确认；失败保留候选，禁止继续修改，重试只保存候选。
- 鱼篓上限 200，单款鱼竿最多 999；图鉴按固定鱼种记录。存档损坏时锁定并保留原文，通过现有诊断查询问题编号。
- 已纳入本地备份。导入含钱包的备份时游戏与钱包按该快照恢复；更早的不含钱包备份同时保留当前钱包与当前钓鱼存档，避免只恢复可出售鱼造成重复兑换。
- 等待与收线表现由前端有效游玩时间驱动，失焦暂停、手动继续；重进会重新等待同一竿。此离线游戏不提供防修改存档或防调试作弊能力。

## 诊断与恢复

开窗在校验主窗口来源后独立处理，不进入任务、打卡和收入维护共用的业务队列。控制器按 closed/loading/ready 管理状态，共享进行中的创建任务，只有完成就绪握手的窗口才会显示；创建、初始化、加载、显示任一步失败均清理并记录失败阶段。

- `PLAYGROUND_OPEN_FAILED`：创建/加载/就绪失败，主窗口提示再次点击摩天轮；日志附 stage 和 correlationId。
- `PLAYGROUND_RENDERER_FAILED`：渲染进程退出，释放旧窗口，主窗口提示重新打开。
- `GAME_FAILED`：组件渲染或动态导入失败，日志包含 gameId、load/render 阶段、correlationId 及有长度限制的错误上下文；宿主显示问题编号，可重开或返回大厅。不记录游戏存档或业务快照。
- 非游乐场窗口、非顶层 frame、非精确页面来源或非白名单命令均拒绝。

技术检查：`npm run typecheck`、`npm run build`、`npm test`。`npm run test:playground` 使用临时数据目录执行真实 Electron 集成测试，包括开窗不阻塞业务和测试游戏的生命周期/错误诊断；运行前结束已确认的本项目开发实例，不关闭正式包。测试游戏仅用于验收，不进入发布目录。开发体验用 `npm run dev`，不可关闭正式包实例。新增窗口/游戏后仍需从主界面的摩天轮实际验收，不用单元测试替代。


## 查看与复制诊断

大厅下方展开“错误诊断”，留空查询最近 50 条，或填问题编号查询仍在保留范围内的记录。展开条目可看错误链、组件堆栈、源码文件与行列位置、窗口 sessionId、游戏 runId、版本与 buildId。点“复制诊断”复制结构化记录。游乐场关闭或崩溃后，在主窗口右键摩天轮复制最近诊断；剪贴板写入成功后才显示成功。

正式版日志：`~/Library/Application Support/DogCow/diagnostics/playground-diagnostics.jsonl`；开发版对应 `DogCow-dev`。每个文件约 256 KiB 后轮转，保留当前文件和一个历史文件；内存最近 100 条、页面暂存最近 50 条、在途写入上限 50 条、单条上报不超过 24 KiB。编号查询可检索轮转文件；超过保留范围的旧记录可能不存在，不承诺无限期保留。

写盘失败时返回未保存状态与 OS 错误链，记录保留在当前应用内存供复制；无法发送给主进程的记录保留在当前页面。内存/页面记录退出后可能丢失。服务端拒绝非法来源、非法游戏 ID/阶段/编号，重建白名单字段；不接受任意文件路径。默认采集错误上下文，不采集游戏存档或主应用业务快照；用户名路径、URL 查询/凭据和常见 token 字段会过滤，长度受限。排障文案禁止自行拼入薪资、任务或完整业务对象。

错误分类包括 create/initialize/load/ready/show、preload/page/renderer/unresponsive、bootstrap/startup、render/event/timer/promise、uncaught/rejection、ipc/clipboard/persistence。加载和就绪超时分开；原生进程退出保留 reason/exitCode，preload 和主页面加载失败保留原始异常链。未响应仅记录并通知，不擅自销毁可能有进度的窗口。

## 构建与源码定位

Vite 每次正式构建生成唯一 buildId 并写入 `dist-renderer/build-info.json`。hidden source map 生成后移到 `build/diagnostics/<buildId>/assets/`，安装包的 renderer 目录不携带 `.map` 或 sourceMappingURL。CI 配置会将该目录作为独立排障 artifact 留存 90 天；本地尚未执行 CI/发布。不要将不同 buildId 的映射混用。用日志中的脚本文件名与行/列偏移，对照对应映射还原 TS/TSX 位置。当前开发模式标识为 development，开发服务器直接提供源码位置。

`npm run test:playground` 还会验证生产偏移到源码的映射、真实受限 preload 的上报/查询/复制、关窗后按编号读回磁盘记录、旧局异步归属和 Error 去重。单元测试覆盖异常链/非标准异常、循环与恶意 getter、脱敏、日志重载与轮转、写盘失败的内存回退及恢复、preload/页面/进程退出分类。测试夹具不进入游戏目录和发布包。
