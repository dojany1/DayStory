/* =====================================================================
   supabase.js — Supabase 백엔드 연결 설정
   =====================================================================
   Supabase란?
     Firebase와 비슷한 백엔드 서비스입니다.
     데이터베이스(PostgreSQL), 회원인증, 파일 저장 등을 제공합니다.
     직접 서버를 만들 필요 없이 API로 바로 데이터를 주고받을 수 있습니다.

   이 파일에서 하는 일:
     Supabase 프로젝트의 URL과 인증 키를 이용해 클라이언트를 생성합니다.
     다른 파일에서 이 클라이언트를 import해서 데이터베이스에 접근합니다.

   사용 예시 (다른 파일에서):
     import { supabase } from './supabase.js';
     const { data } = await supabase.from('stories').select('*');
   ===================================================================== */

import { createClient } from '@supabase/supabase-js';

/* Supabase 프로젝트 URL (대시보드에서 확인 가능) */
const SUPABASE_URL = 'https://zfbbljswxwjevpnzbysw.supabase.co';

/* Supabase Anon(공개) 키 — 클라이언트에서 사용하는 읽기 전용 키 */
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmYmJsanN3eHdqZXZwbnpieXN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTUwMjUsImV4cCI6MjA5MDM3MTAyNX0.TDkqQ8X8zq8_dINUxxi3g7NOqxSUUtcIgLFkyoMJ-tU';

/**
 * supabase — Supabase 클라이언트 인스턴스
 * 이 객체를 통해 데이터베이스 조회, 인증, 파일 업로드 등을 수행합니다.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
