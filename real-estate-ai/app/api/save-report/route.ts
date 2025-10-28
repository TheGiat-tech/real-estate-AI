import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('reports').insert([{
    created_at: new Date().toISOString(),
    address: body.address,
    mode: body.mode,
    sqft: body.sqft,
    price: body.price,
    zestimate: body.zestimate,
    rent: body.rent,
    zip: body.zip,
    detections: body.detections,
    summary: body.summary,
    rehab: body.rehab,
    arv: body.arv,
    metric: body.metric
  }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
