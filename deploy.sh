#!/bin/sh

# ════════════════════════════════════════════════════════════════════════════
# deploy.sh - 通过 adb 把控制面板推送到手机，免去重新打包安装模块
# ════════════════════════════════════════════════════════════════════════════
#
# 推送内容与设备端落点（与 customize.sh 的安装约定一致）：
#
#   box_for_root/webroot/*        →  /data/adb/modules/box_for_root/webroot/
#                                   整体覆盖（先清空再整目录推上去）
#   box/scripts/box.webui         →  /data/adb/box/scripts/box.webui
#                                   推送前把设备上的原文件备份为 box.webui.bak
#
# 为什么不能直接 adb push 到 /data/adb：
#   生产版 adbd 不能 `adb root`，adb push 以 shell(uid 2000) 身份运行，
#   对 /data/adb/ 没有写权限。所以统一先推到 /data/local/tmp，再用 su 搬到目标位置。
#   这也意味着设备必须已 root，且 su 可用。
#
# 用法:
#   ./deploy.sh                # 推送 webroot + box.webui
#   ./deploy.sh --webui-only   # 只推 box.webui
#   ./deploy.sh --webroot-only # 只推 webroot
#   ./deploy.sh --build        # 推送前先构建前端（等价 npm run build:ui）
#   ./deploy.sh --restart      # 推送后重启 box 服务
#   ./deploy.sh --dry-run      # 只打印将要执行的动作，不实际推送
#   ./deploy.sh -s <serial>    # 指定设备（多设备连接时）
#
# 注意:
#   - webroot/ 是构建产物、不入库。若目录不存在，脚本会提示先构建或加 --build。
#   - box.webui 在设备上的权限是 0700（customize.sh 设定），adb push 会把它变成
#     0644。本脚本按约定不修改权限，若推送后 WebUI 无法执行，请手动
#     `adb shell su -c 'chmod 700 /data/adb/box/scripts/box.webui'`。
# ════════════════════════════════════════════════════════════════════════════

set -eu

# 仓库根 = 本脚本所在目录
repo_root=$(cd "$(dirname "$0")" && pwd)

# ── 设备端路径（与 customize.sh 保持一致） ──────────────────────────────────
module_dir="/data/adb/modules/box_for_root"
webroot_dst="${module_dir}/webroot"
scripts_dst="/data/adb/box/scripts"
webui_dst="${scripts_dst}/box.webui"
webui_bak="${webui_dst}.bak"

# adb 推送到这里，再 su 搬运（见文件头说明）
staging_dir="/data/local/tmp/box_deploy"

# ── 本地源路径 ──────────────────────────────────────────────────────────────
webroot_src="${repo_root}/box_for_root/webroot"
webui_src="${repo_root}/box/scripts/box.webui"

# ── 选项 ────────────────────────────────────────────────────────────────────
do_webroot=true
do_webui=true
do_build=false
do_restart=false
dry_run=false
serial=""

while [ $# -gt 0 ]; do
  case "$1" in
    --webui-only)   do_webroot=false ;;
    --webroot-only) do_webui=false ;;
    --build)        do_build=true ;;
    --restart)      do_restart=true ;;
    --dry-run)      dry_run=true ;;
    -s)             shift; serial="${1:-}" ;;
    -h|--help)      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              echo "未知参数: $1（用 --help 查看用法）" >&2; exit 2 ;;
  esac
  shift
done

# ── 输出helpers ─────────────────────────────────────────────────────────────
info()  { printf '\033[32m[+]\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m[!]\033[0m %s\n' "$*"; }
err()   { printf '\033[31m[x]\033[0m %s\n' "$*" >&2; }
step()  { printf '\033[36m==>\033[0m %s\n' "$*"; }

# 设备上以 root 执行一段命令。$1 为要执行的 shell 片段。
# 用单引号包整段，内部若需字面单引号请用 '\'' 转义。
dev_root() {
  adb_cmd shell "su -c '$1'"
}

# 统一构造 adb 命令（支持 -s 指定设备）
adb_cmd() {
  if [ -n "${serial}" ]; then
    adb -s "${serial}" "$@"
  else
    adb "$@"
  fi
}

# 推送一个路径到设备。dry-run 时只打印将要执行的 adb 命令。
adb_push() {
  local src="$1" dst="$2"
  if [ "${dry_run}" = true ]; then
    if [ -n "${serial}" ]; then
      printf '    \033[90m$ adb -s %s push %s %s\033[0m\n' "${serial}" "${src}" "${dst}"
    else
      printf '    \033[90m$ adb push %s %s\033[0m\n' "${src}" "${dst}"
    fi
    return 0
  fi
  adb_cmd push "${src}" "${dst}" >/dev/null
}

# dry-run 时只打印将以 root 身份在设备上执行的命令
show_root() {
  printf '    \033[90m$ adb shell su -c %s\033[0m\n' "'$1'"
}

# ── 前置检查 ────────────────────────────────────────────────────────────────
step "检查 adb 与设备连接"

if ! command -v adb >/dev/null 2>&1; then
  err "未找到 adb，请先安装 Android Platform Tools 并加入 PATH"
  exit 1
fi

device_count=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l | tr -d ' ')

if [ -z "${serial}" ]; then
  if [ "${device_count}" -eq 0 ]; then
    err "没有已连接的设备。请确认手机已插好、USB 调试已开启并授权本机。"
    adb devices
    exit 1
  fi
  if [ "${device_count}" -gt 1 ]; then
    err "检测到多个设备，请用 -s <serial> 指定目标："
    adb devices
    exit 1
  fi
fi

info "设备: $(adb_cmd shell getprop ro.product.model 2>/dev/null | tr -d '\r')"

# 检查 root：su 不可用的话后面全是白费
if [ "${dry_run}" = false ]; then
  if ! dev_root 'echo ok' >/dev/null 2>&1; then
    err "设备上 su 不可用（或未授权）。本脚本需要 root 才能写入 /data/adb/。"
    err "请在手机上授权本机的 su 请求后重试。"
    exit 1
  fi
  info "root 权限: 可用"
fi

# ── 可选：先构建前端 ────────────────────────────────────────────────────────
if [ "${do_build}" = true ]; then
  step "构建前端 (npm run build:ui)"
  if [ "${dry_run}" = true ]; then
    printf '    \033[90m$ (cd ui && npm run build:ui)\033[0m\n'
  else
    ( cd "${repo_root}/ui" && npm run build:ui )
  fi
fi

# ── 校验源文件存在 ──────────────────────────────────────────────────────────
if [ "${do_webroot}" = true ] && [ ! -d "${webroot_src}" ]; then
  err "未找到 ${webroot_src}"
  err "webroot/ 是构建产物、不入库，请先构建：./deploy.sh --build   或   (cd ui && npm run build:ui)"
  exit 1
fi

if [ "${do_webui}" = true ] && [ ! -f "${webui_src}" ]; then
  err "未找到 ${webui_src}"
  exit 1
fi

# 记录本次实际推送的文件数
pushed=0

# ── 1. 推送 webroot（整体覆盖） ─────────────────────────────────────────────
if [ "${do_webroot}" = true ]; then
  step "推送 webroot → ${webroot_dst}"

  file_count=$(find "${webroot_src}" -type f | wc -l | tr -d ' ')
  info "本地 ${file_count} 个文件"

  adb_push "${webroot_src}" "${staging_dir}_webroot"
  # adb push 一个目录到「不存在」的目标路径时，会把目录内容直接铺在该路径下，
  # 不会多套一层 webroot/，所以下面按 <staging>_webroot/. 处理。
  # 该路径若已存在，行为会变成嵌套，因此搬完后立刻删掉它。

  if [ "${dry_run}" = true ]; then
    show_root "mkdir -p '${webroot_dst}' && rm -rf '${webroot_dst}'/* && cp -rf '${staging_dir}_webroot'/. '${webroot_dst}'/"
  else
    # 先建目录、清空旧内容、再整批搬入。清空是为了让删掉的文件不会残留在设备上。
    dev_root "mkdir -p '${webroot_dst}' && rm -rf '${webroot_dst}'/* && cp -rf '${staging_dir}_webroot'/. '${webroot_dst}'/ && rm -rf '${staging_dir}_webroot'"
    info "已覆盖 ${webroot_dst}"
  fi
  pushed=$((pushed + file_count))
fi

# ── 2. 推送 box.webui（先备份 .bak） ────────────────────────────────────────
if [ "${do_webui}" = true ]; then
  step "推送 box.webui → ${webui_dst}"

  adb_push "${webui_src}" "${staging_dir}_webui"

  if [ "${dry_run}" = true ]; then
    show_root "cp -f '${webui_dst}' '${webui_bak}'   # 若已存在则备份"
    show_root "cp -f '${staging_dir}_webui' '${webui_dst}'"
  else
    # 备份现有文件为 .bak（每次覆盖，按约定）
    if dev_root "test -f '${webui_dst}'" >/dev/null 2>&1; then
      dev_root "cp -f '${webui_dst}' '${webui_bak}'"
      info "已备份原文件 → ${webui_bak}"
    else
      warn "设备上不存在 ${webui_dst}，跳过备份"
    fi

    dev_root "mkdir -p '${scripts_dst}' && cp -f '${staging_dir}_webui' '${webui_dst}' && rm -f '${staging_dir}_webui'"
    info "已覆盖 ${webui_dst}"
  fi
  pushed=$((pushed + 1))
fi

# ── 3. 结果 ─────────────────────────────────────────────────────────────────
if [ "${dry_run}" = true ]; then
  echo
  warn "dry-run 结束：以上为将要执行的动作，未实际推送。"
  exit 0
fi

echo
info "完成，共推送 ${pushed} 个文件。"

step "设备端当前状态"
dev_root "ls -la '${webroot_dst}'" || true
echo
dev_root "ls -la '${webui_dst}' '${webui_bak}'" 2>/dev/null || dev_root "ls -la '${webui_dst}'"

echo
if [ "${do_restart}" = true ]; then
  step "重启 box 服务"
  dev_root "'${scripts_dst}/box.service' restart"
  info "服务已重启"
else
  info "提示：改动需重启 box 服务或重新打开 WebUI 才会生效。"
  printf '    \033[90madb shell su -c "%s restart"\033[0m\n' "${scripts_dst}/box.service"
fi
