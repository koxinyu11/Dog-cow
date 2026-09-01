# 自动更新配置（维护者一次性操作）

此项目的 PR 已接入 Sparkle 2：用户在 App 中点击“检查更新”后，可以下载、验证、安装并重启，不再需要手动解压替换 App。项目仍可采用 ad-hoc 签名；Apple Developer ID 和 Mac App Store 都不是 Sparkle 的前置条件。

## 1. 在维护者自己的 Mac 生成 EdDSA 密钥

先运行一次构建，取得 Sparkle 的工具，然后运行：

```sh
.build-dependencies/Sparkle-2.9.6/bin/generate_keys
```

它会把私钥保存在**该维护者的 macOS 钥匙串**并输出公钥。私钥不要提交、不要贴进 Issue/PR，也不要交给外部贡献者。

## 2. 配置 GitHub

在仓库 Settings → Secrets and variables → Actions 中添加：

- Variable `SPARKLE_PUBLIC_ED_KEY`：上一步输出的 base64 公钥。
- Secret `SPARKLE_ED_KEY`：按 Sparkle `generate_keys -x` 导出的私钥文本；该 Secret 只在 Release 工作流中使用。

在 Settings → Pages 中选择从 `main` 分支的 `/docs` 目录发布。更新 feed 固定为 `https://koxinyu11.github.io/Dog-cow/appcast.xml`。appcast 和 `DogCow-Mac.zip` Release 附件必须保持公开、可匿名访问；App 不读取访问令牌、不访问系统钥匙串，也不会给下载请求添加认证信息。

## 3. 发布工作流

在发布 `v*` 标签时，用 Sparkle 的 `sign_update --ed-key-file -` 为 ZIP 生成 EdDSA 签名，并将带有签名、版本号、下载 URL 的 item 写入 `docs/appcast.xml`。CI 中应通过标准输入传入 `SPARKLE_ED_KEY`，不要把私钥放入命令参数或日志。发布后提交更新的 appcast 到 `main`，让 GitHub Pages 提供该 feed。

## 4. 首次发布前验证

将 `SPARKLE_PUBLIC_ED_KEY` 临时导出后执行 `./scripts/build.sh`。打开构建出的 App，点击“检查更新”会直接调用 Sparkle；使用一份旧版本验证匿名下载、EdDSA 验签、安装和重启流程。

Sparkle 的 EdDSA 签名防止恶意更新包被安装。没有 Apple Developer ID 时，首次打开 App 仍可能需要用户在 macOS 安全设置中确认，这是独立于更新机制的系统提示。
