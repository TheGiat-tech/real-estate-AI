import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  if (!address) return NextResponse.json({ error: 'address missing' }, { status: 400 });

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY is not configured' }, { status: 500 });
  }

  const host = 'real-time-zillow-data.p.rapidapi.com';
  const url = `https://${host}/property-details-address?address=${encodeURIComponent(address)}`;

  let r: Response;
  try {
    r = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': host
      },
      cache: 'no-store'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'rapidapi_fetch_failed', detail: (error as Error)?.message ?? 'request failed' },
      { status: 502 }
    );
  }

  if (!r.ok) {
    let detail: any = await r.text();
    try {
      detail = JSON.parse(detail);
    } catch {
      /* ignore non-JSON */
    }

    // Zillow API returns 404 for unknown properties – surface a friendly error
    if (r.status === 404) {
      return NextResponse.json({ error: 'not_found', detail: 'No Zillow data found for that address.' }, { status: 404 });
    }

    return NextResponse.json({ error: 'rapidapi_failed', status: r.status, detail }, { status: 502 });
  }

  const raw: any = await r.json();
  const z = raw?.data ?? raw?.result ?? raw;
  const core = z?.property ?? z?.home ?? z;
  const out = {
    zestimate: core?.zestimate ?? core?.estimate ?? undefined,
    rent: core?.rentZestimate ?? core?.rent_estimate ?? undefined,
    sqft: core?.livingArea ?? core?.sqft ?? undefined,
    beds: core?.bedrooms ?? undefined,
    baths: core?.bathrooms ?? undefined,
    zip: core?.zipcode ?? core?.zip ?? undefined
  };
  return NextResponse.json(out);
}
