import { NextRequest, NextResponse } from 'next/server';
import { getLocalCostFactor } from '@/lib/rpp';
import { computeRehabCost } from '@/lib/costs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.ROBOFLOW_API_KEY) {
    return NextResponse.json({ error: 'ROBOFLOW_API_KEY is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const addressParam = searchParams.get('address') ?? '';
  const modeParam = searchParams.get('mode') ?? 'rental';
  const sqftParam = searchParams.get('sqft') ?? '';
  const purchasePriceParam = searchParams.get('purchase_price') ?? '';

  const form = await req.formData();
  const file = form.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'image missing' }, { status: 400 });

  const formAddress = form.get('address');
  const formMode = form.get('mode');
  const formSqft = form.get('sqft');
  const formPurchasePrice = form.get('purchase_price');
  const formZip = form.get('zip');

  const address = typeof formAddress === 'string' && formAddress ? formAddress : addressParam;
  const mode = typeof formMode === 'string' && formMode ? formMode : modeParam;
  const sqftStr = typeof formSqft === 'string' && formSqft ? formSqft : sqftParam;
  const purchase_price = typeof formPurchasePrice === 'string' && formPurchasePrice ? formPurchasePrice : purchasePriceParam;
  const zip = typeof formZip === 'string' ? formZip : searchParams.get('zip') ?? '';

  const normalizedMode = mode === 'flip' ? 'flip' : 'rental';
  const sqft = Number(sqftStr) || 0;

  // 1) get local factor
  const localFactor = await getLocalCostFactor({ stateCode: undefined, zip });

  // 2) choose baseCosts per finish (you already have them – keep your existing table or constants)
  const baseCosts = normalizedMode === 'flip'
    ? { paint_per_sf: 2.15, flooring_per_sf: 4.25, drywall_per_sf: 2.6, roof_per_sf: 6.0, hvac_per_sf: 3.0, kitchen_per_sf: 5.0, bath_per_sf: 4.0 }
    : { paint_per_sf: 1.25, flooring_per_sf: 2.65, drywall_per_sf: 1.8, roof_per_sf: 4.0, hvac_per_sf: 2.5 };

  // 3) compute rehab with factor
  const rehab = computeRehabCost({ sqft, finish: normalizedMode, baseCosts }, localFactor);

  const u = new URL('https://detect.roboflow.com/property-rehab-arv-estimator');
  u.searchParams.set('api_key', process.env.ROBOFLOW_API_KEY);
  if (address) u.searchParams.set('address', address);
  if (mode) u.searchParams.set('mode', mode);
  if (sqftStr) u.searchParams.set('sqft', String(sqftStr));
  if (purchase_price) u.searchParams.set('purchase_price', String(purchase_price));

  const rfForm = new FormData();
  rfForm.append('image', file);

  try {
    const r = await fetch(u.toString(), { method: 'POST', body: rfForm, cache: 'no-store' });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: 'roboflow_failed', status: r.status, detail: text }, { status: 502 });
    }
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ ...j, localFactor, rehab, address, mode: normalizedMode, sqft, purchase_price, zip });
  } catch (error) {
    return NextResponse.json({ error: 'roboflow_request_failed', detail: (error as Error).message }, { status: 502 });
  }
}
