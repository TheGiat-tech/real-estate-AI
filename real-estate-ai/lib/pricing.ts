// Lightweight, explainable pricing engine.
// Baselines per sq ft; flip > rental. Add your own items easily.
// Location factor: simple state map (can be extended to city/zip).
import type { Mode, PricingBreakdown, LineItem } from "./types";

// ---- BASELINES (USD per sqft) ----
const BASE_RENTAL = {
  interior_paint: 1.10,
  flooring_refresh: 2.50,
  drywall_patch: 0.80,
  mold_remediation: 1.20,
  roof_minor: 0.90,
};
const BASE_FLIP = {
  interior_paint: 1.60,
  flooring_refresh: 3.75,
  drywall_patch: 1.10,
  mold_remediation: 1.85,
  roof_minor: 1.25,
};

// ---- LOCATION FACTOR (state -> multiplier) ----
// Conservative examples; adjust later from BEA/RLB tables if desired.
const STATE_FACTOR: Record<string, number> = {
  AK: 1.18, AL: 0.90, AR: 0.88, AZ: 0.98, CA: 1.25, CO: 1.06, CT: 1.12, DC: 1.28,
  DE: 1.04, FL: 0.98, GA: 0.95, HI: 1.35, IA: 0.92, ID: 0.94, IL: 1.02, IN: 0.92,
  KS: 0.91, KY: 0.90, LA: 0.90, MA: 1.20, MD: 1.08, ME: 1.03, MI: 0.96, MN: 1.02,
  MO: 0.92, MS: 0.86, MT: 0.98, NC: 0.96, ND: 0.99, NE: 0.91, NH: 1.07, NJ: 1.18,
  NM: 0.93, NV: 1.00, NY: 1.22, OH: 0.94, OK: 0.88, OR: 1.06, PA: 1.02, RI: 1.08,
  SC: 0.95, SD: 0.90, TN: 0.94, TX: 0.96, UT: 0.99, VA: 1.04, VT: 1.04, WA: 1.12,
  WI: 0.96, WV: 0.88, WY: 0.94,
};

function inferStateFromAddress(address?: string): string | undefined {
  if (!address) return;
  const m = address.match(/\b(AK|AL|AR|AZ|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/i);
  return m?.[1]?.toUpperCase();
}

export function computePricing(opts: {
  sqft?: number;
  mode: Mode;
  address?: string;
  hasMold?: boolean;
  hasCrack?: boolean;
  hasRoof?: boolean;
}): PricingBreakdown {
  const sqft = Math.max(0, Number(opts.sqft || 0));
  const state = inferStateFromAddress(opts.address) ?? "US";
  const locationFactor = STATE_FACTOR[state] ?? 1.0;
  const base = opts.mode === "flip" ? BASE_FLIP : BASE_RENTAL;

  const lineItems: LineItem[] = [];
  // Always include paint + flooring refresh for turn-key scope
  const li = (key: keyof typeof base, label: string, qtySqft = sqft, unit: LineItem["unit"]="sqft") => {
    const unitCost = +(base[key] * locationFactor).toFixed(2);
    const subtotal = +(qtySqft * unitCost).toFixed(0);
    lineItems.push({ key, label, qty: qtySqft, unit, unitCost, subtotal });
  };

  if (sqft > 0) {
    li("interior_paint", "Interior Paint");
    li("flooring_refresh", "Flooring Refresh");
    li("drywall_patch", "Drywall Patch & Prep", Math.round(sqft * 0.15)); // ~15% wall area proxy
  }

  if (opts.hasMold) li("mold_remediation", "Mold Remediation", Math.round(sqft * 0.1));
  if (opts.hasRoof)  li("roof_minor", "Roof – Minor Repairs", Math.round(sqft * 0.07));

  const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
  const contingencyPct = 0.15;
  const contingency = Math.round(subtotal * contingencyPct);
  const total = subtotal + contingency;

  return {
    locationFactor,
    finishGrade: opts.mode,
    lineItems,
    subtotal,
    contingencyPct,
    contingency,
    total
  };
}
