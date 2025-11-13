export type Detection = { label?: string; class?: string; confidence?: number; score?: number; box?: any; x?: number; y?: number };
const BASE: Record<string, { perSqft?: number; fixed?: number }> = {
  crack: { fixed: 600 },
  mold: { perSqft: 6 },
  water_damage: { perSqft: 5 },
  roof_damage: { perSqft: 9 },
  construction_defect: { perSqft: 2 }
};
export function localityFactor(zip?: string) {
  if (!zip) return 1;
  const z = Number((zip||'').slice(0,3));
  if (z >= 900) return 1.25; // west coast-ish
  if (z >= 700) return 1.15; // east coast-ish
  return 1.0;
}
export function estimateRehab(detections: Detection[], sqft: number, zip?: string) {
  const f = localityFactor(zip);
  let total = 0;
  const lines: { item: string; cost: number }[] = [];
  detections.forEach(d => {
    const k = (d.label || d.class || '').toLowerCase();
    const rule = BASE[k];
    if (!rule) return;
    const cost = Math.round(((rule.perSqft || 0) * (sqft || 0) + (rule.fixed || 0)) * f);
    if (cost > 0) { lines.push({ item: k, cost }); total += cost; }
  });
  // base refresh budget even with few detections
  if (total === 0 && sqft) { const refresh = Math.round(sqft * 12 * f); lines.push({ item: 'refresh_paint_floor_minor', cost: refresh }); total += refresh; }
  const contingency = Math.round(total * 0.15);
  return { lines, subtotal: total, contingency, total: total + contingency };
}
export function computeARV(zestimate?: number, mode: 'rental'|'flip'='rental') {
  if (!zestimate) return undefined;
  return Math.round(zestimate * (mode==='flip' ? 1.07 : 1.05));
}
export function capRate(rent?: number, price?: number) {
  if (!rent || !price) return undefined;
  const noi = rent * 12 * 0.6; // ~40% opex
  return Number(((noi / price) * 100).toFixed(1));
}

export type RehabInputs = {
  sqft: number;
  finish: 'rental' | 'flip';
  baseCosts: {
    paint_per_sf: number;
    flooring_per_sf: number;
    drywall_per_sf: number;
    roof_per_sf: number;
    hvac_per_sf: number;
    kitchen_per_sf?: number;
    bath_per_sf?: number;
  };
};

// NEW: apply a local factor to a numeric cost safely
export function applyLocalFactor(value: number, factor: number | undefined): number {
  const f = Number.isFinite(factor as number) && (factor as number)! > 0 ? (factor as number)! : 1.0;
  return Math.round(value * f);
}

/**
 * computeRehabCost now accepts optional localFactor and returns line items + totals
 */
export function computeRehabCost(inp: RehabInputs, localFactor = 1.0) {
  const { sqft, baseCosts } = inp;

  const items = [
    { category: 'Interior Paint', subtotal: Math.round(baseCosts.paint_per_sf * sqft) },
    { category: 'Flooring',      subtotal: Math.round(baseCosts.flooring_per_sf * sqft) },
    { category: 'Drywall',       subtotal: Math.round(baseCosts.drywall_per_sf * sqft) },
    { category: 'Roof',          subtotal: Math.round(baseCosts.roof_per_sf * sqft) },
    { category: 'HVAC',          subtotal: Math.round(baseCosts.hvac_per_sf * sqft) },
  ];

  if (baseCosts.kitchen_per_sf) {
    items.push({ category: 'Kitchen', subtotal: Math.round(baseCosts.kitchen_per_sf * sqft) });
  }
  if (baseCosts.bath_per_sf) {
    items.push({ category: 'Bathroom', subtotal: Math.round(baseCosts.bath_per_sf * sqft) });
  }

  // apply local factor to each line
  const factored = items.map(it => ({ ...it, subtotal: applyLocalFactor(it.subtotal, localFactor) }));
  const subtotal = factored.reduce((s, it) => s + it.subtotal, 0);
  const contingency = Math.round(subtotal * 0.15);
  const total = subtotal + contingency;

  return {
    items: factored,
    totals: { subtotal, contingencyPct: 0.15, contingency, total }
  };
}
