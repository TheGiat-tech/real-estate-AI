import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import Papa from 'papaparse';

type Rec = { [k: string]: string };

async function main(){
  // Source: BEA Regional Price Parities (MSA-level), CSV URL (update yearly if needed)
  const CSV_URL = 'https://apps.bea.gov/itable/api/download?ReleaseID=RPP&TableName=RPP_MSA_2023&Format=CSV';
  // If this link changes, go to BEA RPP download page and copy the current CSV link for MSA.

  console.log('Downloading BEA MSA RPP CSV…');
  const res = await fetch(CSV_URL);
  if(!res.ok) throw new Error('Failed to download BEA CSV');
  const csv = await res.text();

  console.log('Parsing CSV…');
  const parsed = Papa.parse(csv, { header: true });
  const rows = (parsed.data as Rec[]).filter(r => (r['GeoFIPS'] && r['RPP']));

  const out: Record<string, any> = {};
  for(const r of rows){
    const fips = (r['GeoFIPS'] || '').trim();
    const msa = (r['GeoName'] || '').trim();
    const state = (r['State'] || '').trim();
    const rpp = Number(r['RPP']);
    const housing = Number(r['Housing_RPP'] || r['Housing']);
    const goods = Number(r['Goods_RPP'] || r['Goods']);
    const services = Number(r['Services_RPP'] || r['Services']);
    if(!fips || Number.isNaN(rpp)) continue;
    out[fips] = { msa, state, rpp, housing, goods, services };
  }

  const dest = path.join(process.cwd(), 'data', 'rpp_msa_2023.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('Wrote', dest, 'records:', Object.keys(out).length);
}

main().catch(err=>{ console.error(err); process.exit(1); });
