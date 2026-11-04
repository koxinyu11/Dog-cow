# 桌面构建与发布边界

## 本地候选

运行 `npm run make:mac`：Forge package → codesign ad-hoc → 严格签名验证 → 从已签包生成 ZIP → hdiutil DMG → 完整性与只读挂载/应用签名/Applications 链接验证。

arm64 与 x64 单独产出。当前设备仅能证明已实际启动的架构；Windows 构建配置不等于安装验收。DMG 文件发布只发生在所有校验通过后，失败保留源 App，不用旧产物冒充新构建成功。

## 自动更新

- 当前默认未配置签名 feed，使用用户主动下载。
- 旧 `docs/appcast.xml` 和 `UPDATER_SETUP.md` 属于原生 WKWebView/Sparkle 版本，保持独立。
- 新 Electron feed 必须是明确的 HTTPS 来源、按平台/架构隔离；Mac 需满足 Squirrel.Mac 的签名要求，Windows 需验证 Squirrel 安装事件及升级链路。
- 发布时应替换 ad-hoc 为正式身份、公证并完成签名包到签名包升级测试。不能仅设置一个环境开关就声称已完成发布验收。
- 未保存数据需先处理再重启安装。公开发布、签名身份/凭据配置、更新源切换均需另行授权。

## CI

`.github/workflows/build.yml` 对 main/PR 执行 Mac 类型、测试、构建，上传 artifact；Windows 构建只在手动输入选择时运行。`.github/workflows/release.yml` 只手动准备产物，不发布 GitHub Release，不创建标签，不推送 appcast。

维护者必须明确检查版本、架构、签名和实际运行证据，再单独决定公开发布。不要运行旧式自动 tag/push 流程替代这个检查。
