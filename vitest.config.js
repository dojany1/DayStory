import { defineConfig } from 'vitest/config';

/* =====================================================================
   vitest.config.js — 테스트 실행 스코프 설정
   =====================================================================
   문제(진단 [HIGH 6-1]): vitest 설정이 없으면 node_modules 만 제외하고
   레포 전역에서 *.spec.js / *.test.ts 를 자동 수집한다. 그 결과
   ios/ 빌드 산출물(RevenueCat SPM 체크아웃)의 *.test.ts 가 함께 실행돼
   `npm test` 가 레드가 되고, 빌드 디렉터리 변경마다 결과가 흔들린다.

   해결: 카노니컬 테스트 디렉터리(tests/)의 *.spec.js 만 수집하고,
   빌드/네이티브/비활성 산출물은 명시적으로 제외한다.
   ===================================================================== */
export default defineConfig({
  test: {
    environment: 'jsdom',
    /* Node 22+ 네이티브 Web Storage 가 jsdom localStorage 를 가리는 문제 등 보강 */
    setupFiles: ['./tests/setup.js'],
    /* tests/ 의 *.spec.js 만 카노니컬 스위트로 인정 */
    include: ['tests/**/*.spec.js'],
    /* 빌드 산출물·네이티브 체크아웃·비활성 백업을 테스트 수집에서 제외 */
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/ios/**',
      '**/android/**',
      '**/functions/**',
      '**/_disabled-tests-from-HEAD/**',
      /* 보안 규칙 테스트는 에뮬레이터가 필요 — npm run test:rules 로 별도 실행 */
      'tests/rules/**',
    ],
  },
});
