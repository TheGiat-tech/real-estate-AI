import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address') ?? '';
  const mode = searchParams.get('mode') ?? 'rental';
  const sqft = searchParams.get('sqft') ?? '';
  const purchase_price = searchParams.get('purchase_price') ?? '';

  const form = await req.formData();
  const file = form.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'image missing' }, { status: 400 });

  const u = new URL('https://detect.roboflow.com/property-rehab-arv-estimator');
  u.searchParams.set('api_key', process.env.ROBOFLOW_API_KEY!);
  if (address) u.searchParams.set('address', address);
  if (mode) u.searchParams.set('mode', mode);
  if (sqft) u.searchParams.set('sqft', String(sqft));
  if (purchase_price) u.searchParams.set('purchase_price', String(purchase_price));

  const rfForm = new FormData();
  rfForm.append('image', file);

  const r = await fetch(u.toString(), { method: 'POST', body: rfForm, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return NextResponse.json(j);
}
