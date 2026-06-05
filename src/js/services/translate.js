/* =====================================================================
   translate.js — 자동 번역(translateContent) 콜러블 서비스
   =====================================================================
   에디터에서 한국어 원문 카드 필드를 Cloud Function 으로 보내 en/ja/es/zh
   4개 국어 번역 결과를 받아온다.
   (CLAUDE.md 아키텍처 규칙: Firebase/Functions 접근은 service 레이어 경유)

   - 보안 게이트(Admin Custom Claim)는 서버(functions/translateContent)에서 검증한다.
   - firebase/functions SDK 는 동적 import 로 초기 번들 부담을 0 으로 둔다 (admin.js 패턴).
   ===================================================================== */

import { app } from '../firebase.js';

/**
 * translateContentApi — 한국어 원문 필드를 en/ja/es/zh 로 자동 번역.
 * @param {{ fields: { title?:string, body?:string, country?:string, editor_comment?:string } }} payload
 * @returns {Promise<{ translations: Object }>} { translations: { en:{…}, ja:{…}, es:{…}, zh:{…} } }
 * @throws Cloud Function 호출 실패 시 (권한 없음/네트워크/번역 오류) — 호출부에서 catch 한다.
 */
export async function translateContentApi(payload) {
  if (!app) throw new Error('Firebase 가 초기화되지 않았습니다.');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app, 'asia-northeast3');
  const callable = httpsCallable(functions, 'translateContent');
  const result = await callable(payload);
  return result?.data || { translations: {} };
}
