#!/bin/bash
# No administrator escalation, quarantine changes, or process termination.
set -eu
source_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
application="$source_dir/狗牛.app"
printf '将安装或替换 /Applications/狗牛.app；保留本机数据并备份旧版。\n如狗牛正在运行，请先正常退出。\n'
if ELECTRON_RUN_AS_NODE=1 "$application/Contents/MacOS/狗牛" "$application/Contents/Resources/update-helper.mjs" manual "$application"; then
  printf '\n安装完成。\n'
else
  printf '\n安装未完成；请保留上方恢复目录，或使用拖拽方式手动安装。\n'
fi
read -r -p '按回车关闭…' _
