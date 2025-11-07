import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

function usage() {
  console.log('Usage: npx ts-node scripts/build_zip_to_msa.ts path/to/zip_to_msa.csv');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) usage();

const csvText = fs.readFileSync(inputPath, 'utf8');
const parsed = Papa.parse(csvText, { header: true });

// Try to auto-detect column names
const headerRow = parsed.meta.fields || [];
const zipCol = headerRow.find(h => /zip/i.test(h)) || 'ZIP';
const msaCol = headerRow.find(h => /(msa|cbsa|geoid)/i.test(h)) || 'MSA';

const out: Record<string,string> = {};
for(const r of parsed.data as any[]){
  const zip = (r[zipCol] || '').toString().padStart(5,'0');
  const msa = (r[msaCol] || '').toString();
  if(zip && msa) out[zip] = msa;
}

const dest = path.join(process.cwd(), 'data', 'zip_to_msa.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log('Wrote', dest, 'records:', Object.keys(out).length);
