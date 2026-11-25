import { createClient } from '@supabase/supabase-js';

// Supabase 연결 — .env.local의 주소 · 공개 키가 없으면 null (로그인 · 랭킹 없이 그대로 동작)
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// detectSessionInUrl 끔: 소셜 로그인 · 메일 링크를 안 쓰니, 주소(#access_token=…)로 남의 세션이 심기지 않게
export const supabase = url && key ? createClient(url, key, { auth: { detectSessionInUrl: false } }) : null;
