'use client';
import { useId, useMemo, useRef, useState } from 'react';
import KPICards from './KPICards';
import DamageTable from './DamageTable';
import { estimateRehab, computeARV, capRate, type RehabCostBreakdown } from '@/lib/costs';

type ZillowOut = { zestimate?: number; rent?: number; sqft?: number; zip?: string; beds?: number; baths?: number };

async function downloadPDF(reportData: any) {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData),
  });
  if (!res.ok) { alert('PDF generation error'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appraisal_${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadReportButton({ report }: { report: any }) {
  return (
    <button
      onClick={() => downloadPDF(report)}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
    >
      Download PDF
    </button>
  );
}

export default function Form() {
  const [address,setAddress] = useState('');
  const [mode,setMode] = useState<'rental'|'flip'>('rental');
  const [sqft,setSqft] = useState<number|undefined>();
  const [price,setPrice] = useState<number|undefined>();
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  const [zdata,setZdata] = useState<ZillowOut>({});
  const [detections,setDetections] = useState<any[]>([]);
  const [summary,setSummary] = useState<string>('—');
  const [rehabData, setRehabData] = useState<RehabCostBreakdown | null>(null);
  const [localFactor, setLocalFactor] = useState<number | undefined>();

  async function autofill(){
    if(!address) return alert('Enter address first');
    const res = await fetch(`/api/zillow?address=${encodeURIComponent(address)}`);
    if(!res.ok){ alert('Zillow lookup failed'); return; }
    const j = await res.json();
    setZdata(j);
    if(!sqft && j.sqft) setSqft(j.sqft);
    if(!price && j.zestimate) setPrice(Math.round(j.zestimate));
  }

  async function run(){
    if(!file) return alert('Upload an image');
    setBusy(true);
    setRehabData(null);
    setLocalFactor(undefined);
    try{
      const fd = new FormData();
      fd.append('image', file);
      if (zdata.zip) fd.append('zip', zdata.zip);
      const u = new URL('/api/detect', location.origin);
      if(address) u.searchParams.set('address', address);
      if(mode) u.searchParams.set('mode', mode);
      if(sqft) u.searchParams.set('sqft', String(sqft));
      if(price) u.searchParams.set('purchase_price', String(price));
      if (zdata.zip) u.searchParams.set('zip', zdata.zip);
      const res = await fetch(u.toString(), { method:'POST', body: fd });
      if(!res.ok){
        const err = await res.json().catch(() => null);
        const msg = typeof err?.error === 'string' ? err.error : err?.detail ?? 'Analysis failed';
        alert(msg);
        setDetections([]);
        setSummary('—');
        return;
      }
      const data = await res.json();

      const dets = (data.detections ?? data.predictions ?? []);
      setDetections(dets);
      setSummary(data.summary ?? data.report ?? data.notes ?? '—');
      if (typeof data.localFactor === 'number' && Number.isFinite(data.localFactor)) {
        setLocalFactor(data.localFactor);
      }
      setRehabData(data.rehab ?? null);
      if (!sqft && typeof data.sqft === 'number' && Number.isFinite(data.sqft) && data.sqft > 0) {
        setSqft(Math.round(data.sqft));
      }
      if (!price && typeof data.price === 'number' && Number.isFinite(data.price) && data.price > 0) {
        setPrice(Math.round(data.price));
      }
      if (typeof data.zip === 'string' && data.zip) {
        setZdata(prev => ({ ...prev, zip: data.zip }));
      }
    } finally { setBusy(false); }
  }

  const fallbackRehab = useMemo(() => {
    if(!sqft) return undefined;
    return estimateRehab(detections, sqft, zdata.zip);
  }, [detections, sqft, zdata.zip]);
  const rehab = rehabData?.totals?.total ?? fallbackRehab?.total;
  const arv = computeARV(zdata.zestimate, mode);
  const metric = mode==='rental'
    ? (capRate(zdata.rent, price) ? `${capRate(zdata.rent, price)}%` : undefined)
    : (price && arv ? (arv - price).toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}) : undefined);
  const rehabLineItems = useMemo(() => {
    if (rehabData?.items?.length) return rehabData.items;
    if (fallbackRehab?.lines?.length) {
      return fallbackRehab.lines.map(({ item, cost }) => ({
        category: item.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase()),
        subtotal: cost,
      }));
    }
    return [];
  }, [rehabData, fallbackRehab]);
  const reportPayload = useMemo(() => {
    const detectionsList = (detections || []).map((d: any) => ({
      label: (d.label || d.class || 'Item').toString(),
      confidence: typeof d.confidence === 'number' ? d.confidence : typeof d.score === 'number' ? d.score : undefined,
      note: d.note || d.description || '',
    }));

    const safeSummary = summary && summary !== '—' ? summary : undefined;

    return {
      company: {
        name: 'Real Estate AI Contractors',
        email: 'estimates@realestate.ai',
        phone: '(555) 010-1000',
        address: '123 Market Street, Suite 400, Springfield, USA',
      },
      client: {
        name: 'Property Owner',
      },
      address: address || 'Unspecified property address',
      mode,
      sqft,
      price,
      zestimate: zdata.zestimate,
      rent: zdata.rent,
      zip: zdata.zip,
      detections: detectionsList,
      summary: safeSummary,
      rehab,
      arv,
      metric,
      lineItems: rehabLineItems,
      localFactor,
      disclaimer:
        'Figures herein are planning-level estimates. Contractor bids, permits, and onsite inspections may adjust the final scope.',
      signatures: {
        contractorName: 'Estimator',
        clientName: 'Owner',
        date: new Date().toLocaleDateString(),
      },
    };
  }, [detections, rehab, arv, metric, address, mode, sqft, price, zdata.zestimate, zdata.rent, zdata.zip, summary, rehabLineItems, localFactor]);

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
          <div className="sm:col-span-2">
            <div className="muted text-sm mb-1">Upload Property Image</div>
            <input
              ref={fileInputRef}
              id={fileInputId}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={e=>setFile(e.target.files?.[0]??null)}
            />
            <label
              htmlFor={fileInputId}
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if(event.key === 'Enter' || event.key === ' '){
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="input cursor-pointer flex items-center gap-3 hover:border-white/20 transition"
            >
              <span className="btn">Select Image</span>
              <span className="text-sm text-white/70 truncate" title={file?.name ?? 'No file selected'}>
                {file?.name ?? 'No file selected'}
              </span>
            </label>
          </div>
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
        <div className="hdr mb-3">Download Report</div>
        {typeof localFactor === 'number' && Number.isFinite(localFactor) ? (
          <p className="muted text-sm mb-3">Local cost factor applied: {localFactor.toFixed(2)}</p>
        ) : null}
        <DownloadReportButton report={reportPayload} />
      </div>
    </div>
  );
}
