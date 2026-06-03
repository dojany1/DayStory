import { defineConfig } from 'vitest/config';

/* =====================================================================
   vitest.rules.config.js — Firebase 보안 규칙 에뮬레이터 테스트 전용 설정
   =====================================================================
   tests/rules/*.spec.js 는 @firebase/rules-unit-testing 으로 Firestore/Storage
   에뮬레이터에 직접 붙어 규칙을 검증한다. jsdom 이 아닌 node 환경에서 돈다.

   실행: npm run test:rules
     (= firebase emulators:exec --only firestore,storage "vitest run --config vitest.rules.config.js")
   에뮬레이터가 없으면 실패하므로 기본 `npm test` 스코프에서는 제외되어 있다.
   ===================================================================== */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.spec.js'],
    /* 에뮬레이터 왕복 + 업로드(최대 10MB) 여유 */
    testTimeout: 20000,
    hookTimeout: 30000,
    /* 같은 에뮬레이터 인스턴스를 공유하므로 파일 간 직렬 실행이 안전 */
    fileParallelism: false,
  },
});
