import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.ROBOFLOW_API_KEY) {
    return NextResponse.json({ error: 'ROBOFLOW_API_KEY is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address') ?? '';
  const mode = searchParams.get('mode') ?? 'rental';
  const sqft = searchParams.get('sqft') ?? '';
  const purchase_price = searchParams.get('purchase_price') ?? '';

  const form = await req.formData();
  const file = form.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'image missing' }, { status: 400 });

  const u = new URL('https://detect.roboflow.com/property-rehab-arv-estimator/1');
  u.searchParams.set('api_key', process.env.ROBOFLOW_API_KEY);
  if (address) u.searchParams.set('address', address);
  if (mode) u.searchParams.set('mode', mode);
  if (sqft) u.searchParams.set('sqft', String(sqft));
  if (purchase_price) u.searchParams.set('purchase_price', String(purchase_price));

  const rfForm = new FormData();
  rfForm.append('image', file);

  try {
    const r = await fetch(u.toString(), { method: 'POST', body: rfForm, cache: 'no-store' });
    if (!r.ok) {
      const text = await r.text();
      console.error('Roboflow API error:', { status: r.status, body: text });
      return NextResponse.json({ 
        error: 'Detection failed', 
        message: `Roboflow API returned status ${r.status}. Please check your API key and model configuration.`,
        status: r.status, 
        detail: text 
      }, { status: 502 });
    }
    const j = await r.json().catch(() => ({}));
    
    // Validate that we got a proper response with detections or predictions
    if (!j.predictions && !j.detections) {
      console.warn('Roboflow response missing predictions/detections:', j);
    }
    
    return NextResponse.json(j);
  } catch (error) {
    console.error('Roboflow request error:', error);
    return NextResponse.json({ 
      error: 'Detection request failed', 
      message: `Failed to connect to Roboflow API: ${(error as Error).message}`,
      detail: (error as Error).message 
    }, { status: 502 });
  }
}
