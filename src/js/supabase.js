/* =====================================================================
   supabase.js — Supabase 백엔드 연결 설정
   =====================================================================
   보안 사항:
     - API 키는 소스 코드에 직접 넣지 않고 .env 파일에서 불러옵니다.
     - .env 파일은 .gitignore에 의해 Git에 커밋되지 않습니다.
     - Vite에서 환경변수를 사용하려면 VITE_ 접두사가 필요합니다.
     - import.meta.env.VITE_XXX 형태로 접근합니다.
   ===================================================================== */

import { createClient } from '@supabase/supabase-js';

/*
 * 환경변수에서 Supabase URL과 Anon Key를 읽어옵니다.
 * 이 값들은 프로젝트 루트의 .env 파일에 정의되어 있습니다:
 *   VITE_SUPABASE_URL=https://xxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGci...
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/*
 * 환경변수가 없으면 앱이 멈추지 않도록 안전한 폴백(fallback) 클라이언트를 생성합니다.
 * 폴백 클라이언트는 실제 DB 연결 없이 빈 결과를 반환하므로
 * 게스트 모드로 앱을 부팅할 수 있습니다.
 */

/** 빈 결과를 반환하는 가짜 쿼리 빌더 (체이닝 지원) */
function createMockQueryBuilder() {
  const builder = {
    select:  () => builder,
    insert:  () => builder,
    update:  () => builder,
    delete:  () => builder,
    eq:      () => builder,
    neq:     () => builder,
    gt:      () => builder,
    lt:      () => builder,
    gte:     () => builder,
    lte:     () => builder,
    like:    () => builder,
    ilike:   () => builder,
    in:      () => builder,
    order:   () => builder,
    limit:   () => builder,
    range:   () => builder,
    single:  () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then:        (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
  };
  return builder;
}

/** 환경변수 누락 시 사용되는 폴백 클라이언트 */
function createFallbackClient() {
  console.warn(
    '⚠️ Supabase 환경변수가 설정되지 않았습니다.\n' +
    '게스트 모드로 실행됩니다.\n' +
    '프로젝트 루트에 .env 파일을 만들고 아래 값을 넣어주세요:\n' +
    '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=eyJhbGci...'
  );

  return {
    from: () => createMockQueryBuilder(),
    auth: {
      getSession:        () => Promise.resolve({ data: { session: null }, error: null }),
      getUser:           () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword:() => Promise.resolve({ data: null, error: { message: 'Supabase 미설정' } }),
      signUp:            () => Promise.resolve({ data: null, error: { message: 'Supabase 미설정' } }),
      signOut:           () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload:       () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}

/**
 * supabase — Supabase 클라이언트 인스턴스
 * 환경변수가 올바르게 설정되어 있으면 실제 클라이언트를,
 * 그렇지 않으면 안전한 폴백 클라이언트를 사용합니다.
 */
let supabaseInstance;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('Supabase 클라이언트 생성 실패:', err);
    supabaseInstance = createFallbackClient();
  }
} else {
  supabaseInstance = createFallbackClient();
}

export const supabase = supabaseInstance;
export default supabase;
