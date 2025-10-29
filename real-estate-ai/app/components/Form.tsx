'use client';
import { useId, useRef, useState } from 'react';
import KPICards from './KPICards';
import DamageTable from './DamageTable';
import { estimateRehab, computeARV, capRate } from '@/lib/costs';

type ZillowOut = { zestimate?: number; rent?: number; sqft?: number; zip?: string; beds?: number; baths?: number };

export default function Form() {
  const [address,setAddress] = useState('');
  const [mode,setMode] = useState<'rental'|'flip'>('rental');
  const [sqft,setSqft] = useState<number|undefined>();
  const [price,setPrice] = useState<number|undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  const [zdata,setZdata] = useState<ZillowOut>({});
  const [detections,setDetections] = useState<any[]>([]);
  const [summary,setSummary] = useState<string>('—');
  const [imageSummaries, setImageSummaries] = useState<{ summary: string | null; index: number; filename?: string }[]>([]);

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
    if(files.length === 0) return alert('Upload at least one image');
    setBusy(true);
    try{
      const fd = new FormData();
      files.forEach(file => fd.append('image', file));
      const u = new URL('/api/detect', location.origin);
      if(address) u.searchParams.set('address', address);
      if(mode) u.searchParams.set('mode', mode);
      if(sqft) u.searchParams.set('sqft', String(sqft));
      if(price) u.searchParams.set('purchase_price', String(price));
      const res = await fetch(u.toString(), { method:'POST', body: fd });
      const data = await res.json();

      const dets = (data.detections ?? data.predictions ?? []);
      setDetections(dets);
      const aggregatedSummary = Array.isArray(data.summary)
        ? data.summary.join('\n\n')
        : (data.summary ?? '—');
      setSummary(aggregatedSummary || '—');
      const perImage = Array.isArray(data.perImage) ? data.perImage : [];
      setImageSummaries(perImage.map((entry: any, idx: number) => ({
        index: typeof entry.index === 'number' ? entry.index : idx,
        summary: entry.summary ?? null,
        filename: entry.filename ?? files[typeof entry.index === 'number' ? entry.index : idx]?.name,
      })));
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
          <div className="sm:col-span-2">
            <div className="muted text-sm mb-1">Upload Property Image</div>
            <input
              ref={fileInputRef}
              id={fileInputId}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={event => {
                const selected = Array.from(event.target.files ?? []);
                if (selected.length === 0) return;
                setFiles(prev => {
                  const merged = [...prev];
                  const existingKeys = new Set(prev.map(file => `${file.name}-${file.lastModified}-${file.size}`));
                  selected.forEach(file => {
                    const key = `${file.name}-${file.lastModified}-${file.size}`;
                    if (!existingKeys.has(key)) {
                      merged.push(file);
                      existingKeys.add(key);
                    }
                  });
                  return merged;
                });
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
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
              <span className="text-sm text-white/70 truncate" title={files.length ? `${files.length} file${files.length>1?'s':''} selected` : 'No files selected'}>
                {files.length ? `${files.length} file${files.length>1?'s':''} selected` : 'No files selected'}
              </span>
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-wide text-white/60">Selected Images</div>
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2 text-sm text-white/80">
                      <span className="truncate" title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        className="text-xs text-white/60 hover:text-white"
                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
          <DamageTable rows={(detections||[]).map((d:any)=>({
            type:(d.label||d.class||'').toString(),
            confidence: (d.confidence??d.score)?.toFixed?.(2),
            location: d.imageIndex != null
              ? `Image ${Number(d.imageIndex)+1}${d.imageFilename ? ` – ${d.imageFilename}` : ''}`
              : (d.imageFilename ?? d.filename ?? '')
          }))} />
        </div>
        <div className="card p-5">
          <div className="hdr mb-3">Summary</div>
          {imageSummaries.length > 0 ? (
            <div className="space-y-4 text-sm text-white/90">
              {imageSummaries.map((entry, idx) => (
                <div key={`${entry.index}-${idx}`}>
                  <div className="font-semibold text-white/90">
                    Image {entry.index + 1}{entry.filename ? ` – ${entry.filename}` : ''}
                  </div>
                  <div className="whitespace-pre-wrap text-white/80">{entry.summary || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-sm text-white/90 whitespace-pre-wrap">{summary}</pre>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="hdr mb-3">Download Report</div>
        <button
          className="btn"
          onClick={() => {
            const report = {
              generatedAt: new Date().toISOString(),
              address,
              mode,
              sqft,
              price,
              zestimate: zdata.zestimate,
              rent: zdata.rent,
              zip: zdata.zip,
              selectedImages: files.map(file => file.name),
              detections,
              summary,
              imageSummaries,
              rehab,
              arv,
              metric,
            };
            const contents = JSON.stringify(report, null, 2);
            const blob = new Blob([contents], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const fallbackName = 'property-report';
            const normalizedAddress = address
              ? address
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/gi, '-')
                  .replace(/^-+|-+$/g, '')
              : fallbackName;
            anchor.href = url;
            anchor.download = `${normalizedAddress || fallbackName}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download Report
        </button>
      </div>
    </div>
  );
}
