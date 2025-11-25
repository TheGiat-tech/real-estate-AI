import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (!url || !anon) {
  console.warn('Supabase client not configured: missing SUPABASE_URL or SUPABASE_ANON_KEY');
} else {
  client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const supabase = client;

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}
