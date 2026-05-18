#!/bin/sh

# 1. 엑스코드 클라우드 서버에게 프로젝트 최상단 폴더로 이동하라고 지시
cd ../../../

# 2. Node.js 패키지들(node_modules)을 서버에 설치
npm install

# (주의) 만약 React, Vue 등을 사용해서 npm run build가 필요하다면 아래 주석(#)을 지우고 사용하세요.
# npm run build

# 3. 설치된 패키지와 웹 코드를 iOS 폴더로 동기화
npx cap sync ios