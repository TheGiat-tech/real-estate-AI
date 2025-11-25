import { getSupabaseClient } from './supabase';

export type RppLookupInput = {
  stateCode?: string | null;
  zip?: string | null;
};

/**
 * Try to infer state from ZIP if stateCode not provided.
 * For simplicity here we do a tiny ZIP->state fallback map; 
 * in production prefer a proper ZIP database or the Zillow payload's state.
 */
function stateFromZip(zip?: string | null): string | null {
  if (!zip) return null;
  const z = zip.trim();
  // quick prefixes (very rough): FL 32, NY 10-14, CA 90-96, TX 75-79, AZ 85-86, AL 35-36
  if (/^32/.test(z)) return 'FL';
  if (/^(10|11|12|13|14)/.test(z)) return 'NY';
  if (/^9[0-6]/.test(z)) return 'CA';
  if (/^(75|76|77|78|79)/.test(z)) return 'TX';
  if (/^(85|86)/.test(z)) return 'AZ';
  if (/^(35|36)/.test(z)) return 'AL';
  return null;
}

/**
 * Returns a local multiplier (1.0 default) for cost adjustments.
 * Reads public.state_rpp by state_code. If none found, returns 1.0
 */
export async function getLocalCostFactor({ stateCode, zip }: RppLookupInput): Promise<number> {
  let code = (stateCode || '').toUpperCase().trim();
  if (!code) {
    const inferred = stateFromZip(zip);
    if (inferred) code = inferred;
  }
  if (!code) return 1.0;

  const client = getSupabaseClient();
  if (!client) {
    console.warn('RPP lookup skipped: Supabase client not configured');
    return 1.0;
  }

  const { data, error } = await client
    .from('state_rpp')
    .select('rpp_factor')
    .eq('state_code', code)
    .maybeSingle();

  if (error) {
    console.warn('RPP lookup error:', error.message);
    return 1.0;
  }
  return data?.rpp_factor ? Number(data.rpp_factor) : 1.0;
}
