#!/bin/sh
set -e

# Xcode Cloud(Apple Silicon) Homebrew 경로 등록
export PATH="/opt/homebrew/bin:$PATH"

# Node.js 설치
brew install node

# 리포지토리 루트로 이동
cd "$CI_PRIMARY_REPOSITORY_PATH"

# 패키지 설치
npm install

# 웹 코드 빌드
npm run build

# iOS 동기화
npx cap sync ios