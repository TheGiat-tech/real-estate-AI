import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  if (!address) return NextResponse.json({ error: 'address missing' }, { status: 400 });

  const host = 'real-time-zillow-data.p.rapidapi.com';
  const url = `https://${host}/property-details-address?address=${encodeURIComponent(address)}`;

  const r = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
      'X-RapidAPI-Host': host
    },
    cache: 'no-store'
  });
  if (!r.ok) {
    return NextResponse.json({ error: 'rapidapi failed', status: r.status }, { status: 502 });
  }
  const z: any = await r.json();
  const out = {
    zestimate: z.zestimate ?? z.estimate ?? undefined,
    rent: z.rentZestimate ?? z.rent_estimate ?? undefined,
    sqft: z.livingArea ?? z.sqft ?? undefined,
    beds: z.bedrooms ?? undefined,
    baths: z.bathrooms ?? undefined,
    zip: z.zipcode ?? z.zip ?? undefined
  };
  return NextResponse.json(out);
}
