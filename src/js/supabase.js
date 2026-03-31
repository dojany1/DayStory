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

/* 환경변수가 없으면 개발자에게 경고 */
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '⚠️ Supabase 환경변수가 설정되지 않았습니다.\n' +
    '프로젝트 루트에 .env 파일을 만들고 아래 값을 넣어주세요:\n' +
    '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=eyJhbGci...'
  );
}

/**
 * supabase — Supabase 클라이언트 인스턴스
 * 이 객체를 통해 데이터베이스 조회, 인증, 파일 업로드 등을 수행합니다.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
