#!/bin/sh
set -e
set -x

echo "=== ENV ==="
echo "PWD: $(pwd)"
echo "CI_PRIMARY_REPOSITORY_PATH: ${CI_PRIMARY_REPOSITORY_PATH:-<unset>}"
echo "CI_WORKSPACE: ${CI_WORKSPACE:-<unset>}"
echo "PATH(before): $PATH"

# Apple Silicon + Intel Homebrew 둘 다 등록
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "PATH(after): $PATH"

# Node.js 설치 (이미 깔려 있어도 brew install 은 0으로 종료됨)
brew install node

which node
which npm
node --version
npm --version

# 리포지토리 루트로 이동 (env var 비면 스크립트 위치 기준 fallback)
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"
cd "$REPO_ROOT"
echo "REPO_ROOT: $(pwd)"
ls -la

# 패키지 설치
npm install --no-audit --no-fund

# 설치 결과 확인
ls -la node_modules/@capacitor/ || echo "@capacitor 디렉터리 없음"

# 웹 코드 빌드
npm run build

# iOS 동기화
npx cap sync ios
