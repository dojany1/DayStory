#!/usr/bin/env bash
# =============================================================================
# session-checkpoint.sh — 세션 종료 직전 자동 깃허브 백업
# =============================================================================
# 호출 시점:
#   • Claude Code: .claude/settings.json 의 Stop hook 으로 자동 호출
#   • Codex / Cursor / 그 외 AI: 세션 종료 직전 직접 실행
#
# 동작:
#   1) 변경사항 없으면 no-op
#   2) main / master 브랜치이면 session-checkpoint 브랜치로 자동 전환
#      (사용자의 메인 라인을 자동 커밋으로 오염시키지 않기 위함)
#   3) 모든 변경을 stage & commit (메시지: "chore: auto session checkpoint YYYY-MM-DD HH:MM")
#   4) origin 원격이 있으면 push. 처음이면 --set-upstream. 실패해도 커밋은 보존됨.
#
# 안전 원칙:
#   • 절대 force push 안 함
#   • .env 등 .gitignore 에 등록된 파일은 자동으로 제외됨 (`git add -A` 동작)
#   • push 실패해도 exit 0 (커밋만이라도 로컬에 남기는 것이 목적)
#   • main / master 직접 커밋 금지 (자동으로 session-checkpoint 브랜치로 fall back)
# =============================================================================

set -u  # set -e 는 안 씀 — 어떤 단계가 실패해도 다음 단계는 시도해야 함

# 스크립트 위치 기준으로 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# git 저장소가 아니면 silent exit
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[checkpoint] not a git repo, skipping"
  exit 0
fi

# 변경 없음 → no-op
if [ -z "$(git status --porcelain)" ]; then
  echo "[checkpoint] no changes, skipping"
  exit 0
fi

# 현재 브랜치 확인
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  # detached HEAD — session-checkpoint 브랜치 새로 만들고 옮김
  BRANCH="session-checkpoint"
  echo "[checkpoint] detached HEAD → switching to $BRANCH"
  git checkout -B "$BRANCH" >/dev/null 2>&1 || {
    echo "[checkpoint] failed to switch to $BRANCH, aborting"
    exit 0
  }
fi

# main / master 보호: 자동 커밋이 메인 라인을 더럽히지 않게 session-checkpoint 로 옮김
case "$BRANCH" in
  main|master)
    echo "[checkpoint] on protected branch '$BRANCH' → creating/switching to session-checkpoint"
    git checkout -B session-checkpoint >/dev/null 2>&1 || {
      echo "[checkpoint] failed to switch to session-checkpoint, aborting"
      exit 0
    }
    BRANCH="session-checkpoint"
    ;;
esac

# 커밋
TIMESTAMP="$(date +'%Y-%m-%d %H:%M')"
MSG="chore: auto session checkpoint $TIMESTAMP"

git add -A
if ! git commit -m "$MSG" --allow-empty >/dev/null 2>&1; then
  echo "[checkpoint] commit failed (perhaps pre-commit hook?). Try manually."
  exit 0
fi

SHORT_SHA="$(git rev-parse --short HEAD)"
echo "[checkpoint] committed $SHORT_SHA on '$BRANCH'"

# 원격 push
if git remote get-url origin >/dev/null 2>&1; then
  # 원격에 같은 이름 브랜치가 없으면 -u 옵션으로 새로 등록
  if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    PUSH_CMD="git push origin $BRANCH"
  else
    PUSH_CMD="git push -u origin $BRANCH"
  fi
  if eval "$PUSH_CMD" >/dev/null 2>&1; then
    echo "[checkpoint] pushed to origin/$BRANCH"
  else
    echo "[checkpoint] push failed (offline / auth?). Commit saved locally; try 'git push' later."
  fi
else
  echo "[checkpoint] no 'origin' remote, skipping push"
fi

exit 0
