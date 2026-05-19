#!/bin/sh

# 1. 클라우드 컴퓨터에 Node.js(npm)를 먼저 설치합니다. (새로 추가된 줄)
brew install node

# 2. 프로젝트 최상단 폴더로 이동
cd ../../../

# 3. 패키지 설치
npm install

# 4. 웹 코드 빌드
npm run build

# 5. iOS로 파일 동기화
npx cap sync ios