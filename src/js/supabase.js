/* ============================================
   DayStory — Supabase Client
   ============================================ */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zfbbljswxwjevpnzbysw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmYmJsanN3eHdqZXZwbnpieXN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTUwMjUsImV4cCI6MjA5MDM3MTAyNX0.TDkqQ8X8zq8_dINUxxi3g7NOqxSUUtcIgLFkyoMJ-tU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
