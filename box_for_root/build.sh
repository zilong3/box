#!/bin/sh

# 构建脚本：自动打包 Box 模块为 zip 文件
#
# 仓库布局（重构后）：
#   box/           模块运行数据，安装时整体落到设备端 /data/adb/box
#   box_for_root/  KernelSU/Magisk 模块部分：META-INF、module.prop、customize.sh、
#                  webroot、action.sh、box_service.sh、uninstall.sh 及仓库元数据
#   ui/            控制面板前端工程（源码不进 zip，构建产物落到 box_for_root/webroot）
#
# zip 内部布局必须与 customize.sh 的约定一致，顶层为：
#   box/  META-INF/  module.prop  customize.sh  action.sh  box_service.sh
#   uninstall.sh  webroot/  README.md
# customize.sh 依赖 "$MODPATH/box" 存在，因此先把两个目录装配到同一层再打包。

set -e

# 无论从哪个目录调用，都切到脚本所在目录（box_for_root/），保证相对路径可靠
cd "$(dirname "$0")" || exit 1

repo_root=$(cd .. && pwd)
module_dir="${repo_root}/box"

if [ ! -d "$module_dir" ]; then
  echo "错误：未找到模块数据目录 ${module_dir}" >&2
  exit 1
fi

VERSION=$(grep '^version=' module.prop | awk -F '=' '{print $2}' | tr -d '\r')
zip_name="box-${VERSION}.zip"

# 装配目录：把 box/ 放到 box/，把 box_for_root/ 的打包项铺到装配根
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT INT TERM

mkdir -p "${stage}/box"
cp -a "${module_dir}/." "${stage}/box/"

# box_for_root 中需要进入 zip 的条目（与重构前 zip 的顶层内容保持一致）
# 不包含：build.sh / CHANGELOG.md / LICENSE / update.json / *.zip
for entry in \
  META-INF \
  action.sh \
  box_service.sh \
  customize.sh \
  module.prop \
  uninstall.sh \
  webroot \
  README.md
do
  if [ -e "$entry" ]; then
    cp -a "$entry" "${stage}/"
  else
    echo "警告：打包项缺失 ${entry}" >&2
  fi
done

out_dir="${OUT_DIR:-$repo_root}"
mkdir -p "$out_dir"
rm -f "${out_dir}/${zip_name}"

( cd "$stage" && zip -r -o -X -ll "${out_dir}/${zip_name}" ./ >/dev/null )

echo "已生成: ${out_dir}/${zip_name}"
