# 国内节假日与调休数据

`2026.json` 是 [NateScarlet/holiday-cn](https://github.com/NateScarlet/holiday-cn) 的原始年度 JSON 快照，于 2026-11-04 获取。

- 原始文件：https://github.com/NateScarlet/holiday-cn/blob/dcecbce230a57639cc8967ec9e2465e744880fd8/2026.json
- 对应数据提交：`dcecbce230a57639cc8967ec9e2465e744880fd8`，2025-11-04。
- 原始国务院安排出处保留在 JSON 的 `papers` 中。
- 上游采用 MIT License，完整声明保留于 `LICENSE.holiday-cn.txt`；Copyright (c) 2019 NateScarlet。

年度文件只包含特殊放假和补班日期，不包含所有普通周末。`isOffDay: true` 表示休息，`false` 表示补班；未出现在覆盖表中的日期按用户的每周工作日判断。

运行时优先使用 24 小时内的有效缓存，否则请求 GitHub raw / jsDelivr 更新；失败时使用有效旧缓存或内存中的 2026 年快照。年度 JSON 通过静态导入参与经典脚本打包，原生 `file://` 入口无需对本地 JSON 发起 fetch；即使环境没有 fetch 能力，仍会验证内存快照后使用并缓存。返回 HTTP 200 但 `days` 或 `papers` 为空的年度文件视为尚未发布，不会当作无节假日的全年日历。

国务院按通知年份发布安排，次年文件可能包含本年 12 月的调休，因此调用方同时加载本年和次年，并按顺序合并覆盖表。未提供 2027 年快照，不会请求不存在的本地年度文件。新增年度快照时应同时更新 `src/calendar.js` 的 `SNAPSHOTS` 映射及数据更新时间，并保留上游许可证。
