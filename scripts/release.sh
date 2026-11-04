#!/bin/zsh
set -euo pipefail
print "此命令仅构建本地候选，不创建标签或公开发布。发布边界见 docs/RELEASES.md。"
"${0:A:h}/build.sh"
