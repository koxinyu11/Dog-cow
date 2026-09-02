# 狗牛

狗牛是一款原生 macOS 工作任务 App。辅助你成为更优秀的工作牛马。

## 功能

- 周一至周日任务、日历和历史记录
- 单项任务与整周任务快速创建
- 截止时间/无具体时间、优先级、可复用历史标签、备注和进展
- 截止日期设置、剩余天数与过期状态；未完成任务可一键同步到下一日
- 任务达到 100% 时显示牛吃草完成反馈，并适配系统“减少动态效果”
- 增加你工作的成就感
- GitHub Release 应用内更新检查（Sparkle）

## 构建

需要 macOS 11 或更高版本及 Xcode Command Line Tools：

```sh
./scripts/build.sh
```

产物位于 `dist/狗牛-通用版-Mac安装包.zip`，支持 Apple Silicon 和 Intel Mac。
## 应用内更新

App 使用 Sparkle 从公开可匿名访问的 appcast 与 GitHub Release 附件下载、验证、安装更新并重启，用户无需手动解压替换，也无需提供 GitHub 登录凭证。更新包仍必须通过 Sparkle EdDSA 签名验证。维护配置见 [`docs/UPDATER_SETUP.md`](docs/UPDATER_SETUP.md)。

版本由根目录 `VERSION` 管理。推送 `v*` 标签后，GitHub Actions 会构建通用安装包并创建 Release。

## 自动提交和推送

在这台 Mac 上运行一次：

```sh
./scripts/install-auto-sync.sh
```

后台服务每两分钟检查一次这个独立仓库。发现改动后会自动提交并推送到 `main`；不会扫描或上传外层目录。

## 数据说明

任务存储在 WebKit 的本机存储中。仓库和安装包仅包含空白通用模板，不包含任何个人任务。
