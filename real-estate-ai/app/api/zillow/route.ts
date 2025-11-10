import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Helper function to pick the first valid numeric value from candidates.
 * Returns undefined if none are valid numbers.
 */
function pickNumber(...candidates: any[]): number | undefined {
  for (const val of candidates) {
    if (typeof val === 'number' && !isNaN(val)) {
      return val;
    }
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  
  // Error: address_missing
  if (!address) {
    return NextResponse.json(
      { 
        error: 'address_missing', 
        message: 'Address parameter is required',
        code: 'address_missing'
      }, 
      { status: 400 }
    );
  }

  // Error: config - missing API key
  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json(
      { 
        error: 'config', 
        message: 'RAPIDAPI_KEY is not configured',
        code: 'config'
      }, 
      { status: 500 }
    );
  }

  // Read environment variables with fallback defaults
  const host = process.env.RAPIDAPI_HOST || 'real-time-zillow-data.p.rapidapi.com';
  const path = process.env.RAPIDAPI_ADDRESS_PATH || '/property-details-address';
  const url = `https://${host}${path}?address=${encodeURIComponent(address)}`;

  let r: Response;
  try {
    r = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': host
      },
      cache: 'no-store'
    });
  } catch (err: any) {
    // Error: network_failure
    const detail = (err?.message || String(err)).substring(0, 1000);
    return NextResponse.json(
      { 
        error: 'network_failure', 
        message: 'Network request failed',
        code: 'network_failure',
        detail,
        url,
        host
      }, 
      { status: 502 }
    );
  }

  if (!r.ok) {
    // Error: rapidapi_failed
    let detail = '';
    try {
      detail = (await r.text()).substring(0, 1000);
    } catch {
      detail = 'Unable to read response body';
    }
    return NextResponse.json(
      { 
        error: 'rapidapi_failed', 
        message: 'RapidAPI request failed',
        code: 'rapidapi_failed',
        status: r.status, 
        detail,
        url,
        host
      }, 
      { status: 502 }
    );
  }

  let z: any;
  try {
    z = await r.json();
  } catch (err: any) {
    // Error: parse_failed
    const detail = (err?.message || String(err)).substring(0, 1000);
    return NextResponse.json(
      { 
        error: 'parse_failed', 
        message: 'Failed to parse RapidAPI response',
        code: 'parse_failed',
        detail,
        url,
        host
      }, 
      { status: 502 }
    );
  }

  // Normalize multiple possible field names
  const out: any = {
    zestimate: pickNumber(z.zestimate, z.estimate, z.price, z.zestimateValue),
    rent: pickNumber(z.rentZestimate, z.rent_estimate, z.rent, z.rentzestimate, z.rentEstimate),
    sqft: pickNumber(z.livingArea, z.sqft, z.square_feet, z.squareFeet, z.livingAreaValue),
    beds: pickNumber(z.bedrooms, z.beds, z.bedroomCount),
    baths: pickNumber(z.bathrooms, z.baths, z.bathroomCount),
    zip: z.zipcode ?? z.zip ?? z.postalCode ?? z.zipCode ?? undefined
  };

  // In development mode, include raw payload for debugging
  if (process.env.NODE_ENV === 'development') {
    out.raw = z;
  }

  return NextResponse.json(out);
}
