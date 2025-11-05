import { NextResponse } from 'next/server';
import { getLocalCostFactor } from '@/lib/rpp';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state') || undefined;
  const zip = searchParams.get('zip') || undefined;

  const factor = await getLocalCostFactor({ stateCode: state, zip });
  return NextResponse.json({ state, zip, factor });
}
