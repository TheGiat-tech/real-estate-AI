import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  if (!address) return NextResponse.json({ error: 'address missing' }, { status: 400 });

  const rapidApiKey = process.env.RAPIDAPI_KEY ?? process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
  if (!rapidApiKey) {
    return NextResponse.json(
      {
        error: 'rapidapi_key_missing',
        detail: 'RAPIDAPI_KEY environment variable is not configured.'
      },
      { status: 500 }
    );
  }

  const host = 'real-time-zillow-data.p.rapidapi.com';
  const url = `https://${host}/property-details-address?address=${encodeURIComponent(address)}`;

  let r: Response;
  try {
    r = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
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

    const detailMessage = (() => {
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail === 'object') {
        for (const key of ['message', 'detail', 'error', 'errors']) {
          const value = (detail as Record<string, unknown>)[key];
          if (typeof value === 'string') return value;
        }
        try {
          return JSON.stringify(detail);
        } catch {
          /* ignore */
        }
      }
      return undefined;
    })();

    // Zillow API returns 404 for unknown properties – surface a friendly error
    if (r.status === 404) {
      return NextResponse.json({ error: 'not_found', detail: 'No Zillow data found for that address.' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'rapidapi_failed',
        status: r.status,
        detail: detailMessage ?? 'RapidAPI Zillow request failed.'
      },
      { status: 502 }
    );
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
