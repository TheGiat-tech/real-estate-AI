export type SupabaseClient = {
  from: (...args: any[]) => any;
};

export const supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  console.warn("Supabase client not configured");
  return null;
}
