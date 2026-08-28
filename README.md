# 狗牛

狗牛是一款原生 macOS 工作任务 App。安装包不包含作者的个人任务，每位使用者的数据只保存在自己的 Mac 中。

## 功能

- 周一至周日任务、日历和历史记录
- 单项任务与整周任务快速创建
- 时间/无具体时间、优先级、标签、备注和进展
- GitHub Release 私人更新检查

## 构建

需要 macOS 11 或更高版本及 Xcode Command Line Tools：

```sh
./scripts/build.sh
```

产物位于 `dist/狗牛-通用版-Mac安装包.zip`，支持 Apple Silicon 和 Intel Mac。

## 私人仓库更新

App 首次点击“检查更新”时会要求 GitHub fine-grained personal access token。请把 Repository access 仅设为 `Dog-cow`，并把 Contents 权限设为 Read-only。令牌只保存在 macOS 钥匙串，不会写入源码、任务数据或安装包。使用者必须拥有该私人仓库的访问权限。

版本由根目录 `VERSION` 管理。推送 `v*` 标签后，GitHub Actions 会构建通用安装包并创建 Release。

## 数据说明

任务存储在 WebKit 的本机存储中。仓库和安装包仅包含空白通用模板，不包含任何个人任务。
