#!/bin/sh

# ════════════════════════════════════════════════════════════════════════════
# sync-upstream.sh - 把 upstream(boxproxy/box) 的新版本同步进本 fork
# ════════════════════════════════════════════════════════════════════════════
#
# 分工模型（重要）：
#   master   上游镜像分支。只允许快进（--ff-only）跟随 upstream/master，
#            不要在 master 上提交 fork 自己的改动，否则快进会失败。
#   ui       fork 工作分支（同时是仓库默认分支）。同步时把 master 合并进来。
#
# 目录重构（box/ + box_for_root/ + ui/）都在 fork 自己的提交里，
# 得益于 git 的 rename 检测，上游对「被移动文件」的改动通常会自动落到新路径。
#
# 已知冲突高发点：
#   box/scripts/box.service、box/scripts/box.tool   双方改同一行时冲突
#   build.sh（上游）↔ box_for_root/build.sh          修改/删除冲突
#   webroot/index.html（上游）                        fork 已删除，冲突时保持删除
#
# 用法:
#   ./sync-upstream.sh                 # fetch + 快进 master + merge 进 ui
#   ./sync-upstream.sh --rebase        # 用 rebase 代替 merge（线性历史，但重写提交）
#   ./sync-upstream.sh --branch dev    # 指定工作分支（默认 ui）
#   ./sync-upstream.sh --check         # 只报告领先/落后，不做任何改动
#   ./sync-upstream.sh --no-backup     # 同步前不建安全备份 ref
#   ./sync-upstream.sh -h | --help
#
# 说明:
#   - 工作区不干净时拒绝执行，避免把未提交改动卷进 merge。
#   - 可用环境变量覆盖默认值：UPSTREAM_URL / UPSTREAM_REMOTE /
#     MIRROR_BRANCH / WORK_BRANCH。
#   - 回退：git reset --hard <脚本打印的备份 ref>（在未 push 之前）。
# ════════════════════════════════════════════════════════════════════════════

set -eu

repo_root=$(cd "$(dirname "$0")" && pwd)
cd "$repo_root"

upstream_remote="${UPSTREAM_REMOTE:-upstream}"
upstream_url="${UPSTREAM_URL:-https://github.com/boxproxy/box.git}"
mirror_branch="${MIRROR_BRANCH:-master}"
work_branch="${WORK_BRANCH:-ui}"

strategy=merge
check_only=false
do_backup=true

while [ $# -gt 0 ]; do
  case "$1" in
    --rebase)    strategy=rebase ;;
    --branch)    shift; work_branch="${1:-}" ;;
    --check)     check_only=true ;;
    --no-backup) do_backup=false ;;
    -h|--help)   awk 'NR>1 && /^set -eu/{exit} NR>1{sub(/^# ?/,""); print}' "$0"; exit 0 ;;
    *)           echo "未知参数: $1（用 --help 查看用法）" >&2; exit 2 ;;
  esac
  shift
done

# ── 输出 helpers ────────────────────────────────────────────────────────────
info()  { printf '\033[32m[+]\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m[!]\033[0m %s\n' "$*"; }
err()   { printf '\033[31m[x]\033[0m %s\n' "$*" >&2; }
step()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
die()   { err "$*"; exit 1; }

conflict_hints() {
  cat >&2 <<'EOF'
  ---- 已知冲突高发点 ----
    box/scripts/box.service / box.tool   双方改同一行 → 手工合并
    build.sh                             上游改了它，fork 已删除 → 把改动移植到
                                         box_for_root/build.sh，然后 git rm build.sh
    webroot/index.html                   上游改了它，fork 已删除 → git rm webroot/index.html
  查看冲突: git status
  放弃同步: git merge --abort  或  git rebase --abort
EOF
}

# ── 前置检查 ────────────────────────────────────────────────────────────────
command -v git >/dev/null 2>&1 || die "未找到 git"
git rev-parse --git-dir >/dev/null 2>&1 || die "当前目录不是 git 仓库"

[ -n "$work_branch" ] || die "--branch 后面必须给分支名"
git rev-parse --verify -q "refs/heads/$work_branch" >/dev/null \
  || die "本地没有分支 $work_branch（可用 --branch 指定其它分支）"

current_branch=$(git symbolic-ref --short -q HEAD || true)
[ -n "$current_branch" ] || die "当前处于 detached HEAD，请先切到分支再同步"

if [ "$check_only" = false ] && [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交改动，请先 commit 或 stash 后再同步"
fi

if ! git remote get-url "$upstream_remote" >/dev/null 2>&1; then
  step "添加 upstream remote: $upstream_url"
  git remote add "$upstream_remote" "$upstream_url"
fi

# ── 拉取上游 ────────────────────────────────────────────────────────────────
step "fetch $upstream_remote"
git fetch --prune --tags "$upstream_remote"

upstream_ref="${upstream_remote}/${mirror_branch}"
git rev-parse --verify -q "$upstream_ref" >/dev/null \
  || die "找不到 $upstream_ref（确认 upstream 分支名，当前 MIRROR_BRANCH=$mirror_branch）"

behind=$(git rev-list --count "${work_branch}..${upstream_ref}")
ahead=$(git rev-list --count "${upstream_ref}..${work_branch}")
info "分支 $work_branch：落后 upstream ${behind} 个提交，领先 ${ahead} 个提交"

if [ "$behind" -gt 0 ]; then
  step "上游待并入的提交（最新 10 条）"
  git --no-pager log --oneline -n 10 "$upstream_ref"
fi

if [ "$check_only" = true ]; then
  if [ "$behind" -eq 0 ]; then
    info "--check：已与 upstream 同步，无需操作"
  else
    warn "--check：需要同步，执行 ./sync-upstream.sh"
  fi
  exit 0
fi

# ── 更新镜像分支（只快进） ──────────────────────────────────────────────────
step "更新镜像分支 $mirror_branch（仅快进）"
if git show-ref --verify -q "refs/heads/$mirror_branch"; then
  if ! git merge-base --is-ancestor "refs/heads/$mirror_branch" "$upstream_ref"; then
    die "本地 $mirror_branch 含有 upstream 之外的提交，拒绝覆盖；请人工处理后重试"
  fi
  if [ "$current_branch" = "$mirror_branch" ]; then
    git merge --ff-only "$upstream_ref"
  else
    # 用 update-ref 只挪 ref，不动 master 的 upstream 跟踪配置（push 仍指向 origin）
    git update-ref "refs/heads/$mirror_branch" "$upstream_ref"
  fi
else
  git branch "$mirror_branch" "$upstream_ref"
fi
info "$mirror_branch -> $(git rev-parse --short "$mirror_branch")"

if [ "$behind" -eq 0 ]; then
  info "工作分支 $work_branch 已包含 upstream，无需合并"
  exit 0
fi

# ── 切到工作分支 ────────────────────────────────────────────────────────────
if [ "$current_branch" != "$work_branch" ]; then
  step "切换到 $work_branch"
  git checkout "$work_branch"
fi

# 复用冲突解决方案，结构分叉场景下很省事
git config rerere.enabled true || true

# fork 把换行符统一成了 LF（见 .gitattributes），而上游部分文件仍是 CRLF
# （module.prop、box/sing-box/config.json）。开启 renormalize 后 git 会先把
# 两边都规范化再合并，避免"只是行尾不同"造成的整文件冲突。
git config merge.renormalize true || true

# ── 安全备份 ────────────────────────────────────────────────────────────────
backup_ref=""
if [ "$do_backup" = true ]; then
  backup_ref="refs/backup/sync-$(date +%Y%m%d-%H%M%S)"
  git update-ref "$backup_ref" HEAD
  info "安全备份: $backup_ref -> $(git rev-parse --short HEAD)"
fi

# ── 合并 / 变基 ─────────────────────────────────────────────────────────────
step "把 $mirror_branch $strategy 进 $work_branch"
if [ "$strategy" = rebase ]; then
  if ! git rebase "$mirror_branch"; then
    err "rebase 冲突，需要人工解决"
    conflict_hints
    if [ -n "$backup_ref" ]; then
      err "回退: git rebase --abort   或   git reset --hard $backup_ref"
    fi
    exit 1
  fi
  warn "已 rebase：若 $work_branch 曾推送过，需要用 git push --force-with-lease"
else
  if ! git merge --no-edit "$mirror_branch"; then
    err "merge 冲突，需要人工解决"
    conflict_hints
    if [ -n "$backup_ref" ]; then
      err "回退: git merge --abort"
    fi
    exit 1
  fi
fi

# ── 结果 ────────────────────────────────────────────────────────────────────
info "同步完成：$work_branch 已包含 $upstream_ref"
step "本次并入的上游提交"
git --no-pager log --oneline -n "$behind" "$upstream_ref"
if [ -n "$backup_ref" ]; then
  info "如需回退: git reset --hard $backup_ref"
fi
