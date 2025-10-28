'use client';
import { useState } from 'react';
import KPICards from './KPICards';
import DamageTable from './DamageTable';
import { estimateRehab, computeARV, capRate } from '@/lib/costs';

type ZillowOut = { zestimate?: number; rent?: number; sqft?: number; zip?: string; beds?: number; baths?: number };

export default function Form() {
  const [address,setAddress] = useState('');
  const [mode,setMode] = useState<'rental'|'flip'>('rental');
  const [sqft,setSqft] = useState<number|undefined>();
  const [price,setPrice] = useState<number|undefined>();
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);

  const [zdata,setZdata] = useState<ZillowOut>({});
  const [detections,setDetections] = useState<any[]>([]);
  const [summary,setSummary] = useState<string>('—');

  async function autofill(){
    if(!address) return alert('Enter address first');
    let res: Response;
    try {
      res = await fetch(`/api/zillow?address=${encodeURIComponent(address.trim())}`);
    } catch (error) {
      console.error('zillow lookup error', error);
      alert('Zillow lookup failed: network error');
      return;
    }
    if(!res.ok){
      let msg = `status ${res.status}`;
      try {
        const data = await res.json();
        msg = data?.detail || data?.error || msg;
      } catch {
        /* ignore */
      }
      alert(`Zillow lookup failed: ${msg}`);
      return;
    }
    const j = await res.json();
    if(!j || Object.keys(j).length === 0){
      alert('No Zillow data returned for that address.');
      return;
    }
    setZdata(j);
    if(!sqft && j.sqft) setSqft(j.sqft);
    if(!price && j.zestimate) setPrice(Math.round(j.zestimate));
  }

  async function run(){
    if(!file) return alert('Upload an image');
    setBusy(true);
    try{
      const fd = new FormData();
      fd.append('image', file);
      const u = new URL('/api/detect', location.origin);
      if(address) u.searchParams.set('address', address);
      if(mode) u.searchParams.set('mode', mode);
      if(sqft) u.searchParams.set('sqft', String(sqft));
      if(price) u.searchParams.set('purchase_price', String(price));
      const res = await fetch(u.toString(), { method:'POST', body: fd });
      const data = await res.json();

      const dets = (data.detections ?? data.predictions ?? []);
      setDetections(dets);
      setSummary(data.summary ?? '—');
    } finally { setBusy(false); }
  }

  const rehab = (() => {
    if(!sqft) return undefined;
    return estimateRehab(detections, sqft, zdata.zip).total;
  })();
  const arv = computeARV(zdata.zestimate, mode);
  const metric = mode==='rental'
    ? (capRate(zdata.rent, price) ? `${capRate(zdata.rent, price)}%` : undefined)
    : (price && arv ? (arv - price).toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}) : undefined);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><div className="muted text-sm mb-1">Property Address</div><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="1093 Hibiscus St, FL 32233" /></div>
          <div><div className="muted text-sm mb-1">Investment Mode</div>
            <select className="sel" value={mode} onChange={e=>setMode(e.target.value as any)}>
              <option value="rental">Rental (Buy & Hold)</option>
              <option value="flip">Flip (Resale)</option>
            </select>
          </div>
          <div><div className="muted text-sm mb-1">Square Footage (sqft)</div><input className="input" value={sqft ?? ''} onChange={e=>setSqft(Number(e.target.value)||undefined)} placeholder="auto from Zillow" /></div>
          <div><div className="muted text-sm mb-1">Purchase Price (USD)</div><input className="input" value={price ?? ''} onChange={e=>setPrice(Number(e.target.value)||undefined)} placeholder="optional (can prefill)" /></div>
          <div className="sm:col-span-2"><div className="muted text-sm mb-1">Upload Property Image</div><input className="input" type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)} /></div>
        </div>
        <div className="flex gap-3 mt-4">
          <button className="btn" onClick={run} disabled={busy}>{busy?'Analyzing…':'Analyze & Generate Report'}</button>
          <button className="btn bg-white/10" onClick={autofill}>Auto-fill from Zillow</button>
        </div>
      </div>

      <KPICards rehab={rehab} arv={arv} metric={metric} rent={zdata.rent} />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="hdr mb-3">Detected Damages</div>
          <DamageTable rows={(detections||[]).map((d:any)=>({ type:(d.label||d.class||'').toString(), confidence: (d.confidence??d.score)?.toFixed?.(2) }))} />
        </div>
        <div className="card p-5">
          <div className="hdr mb-3">Summary</div>
          <pre className="text-sm text-white/90 whitespace-pre-wrap">{summary}</pre>
        </div>
      </div>

      <div className="card p-5">
        <div className="hdr mb-3">Save Report</div>
        <button className="btn" onClick={async ()=>{
          const res = await fetch('/api/save-report', {
            method:'POST',
            headers: { 'content-type':'application/json' },
            body: JSON.stringify({
              address, mode, sqft, price,
              zestimate: zdata.zestimate, rent: zdata.rent, zip: zdata.zip,
              detections, summary, rehab, arv, metric
            })
          });
          alert(res.ok ? 'Saved to Supabase' : 'Save failed');
        }}>Save to Supabase</button>
      </div>
    </div>
  );
}
