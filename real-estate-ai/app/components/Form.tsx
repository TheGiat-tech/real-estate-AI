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
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  const [zdata,setZdata] = useState<ZillowOut>({});
  const [detections,setDetections] = useState<any[]>([]);
  const [summary,setSummary] = useState<string>('—');

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

  const downloadReport = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt' });
    const margin = 48;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    const formatCurrency = (value?: number) =>
      typeof value === 'number'
        ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
        : 'N/A';
    const formatPercent = (value?: number) =>
      typeof value === 'number'
        ? `${Math.round(value * 100)}%`
        : '—';

    const normalizedAddress = address
      ? address
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '')
      : 'property-report';

    const ensureSpace = (spaceNeeded: number) => {
      if (y + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const sectionHeader = (title: string) => {
      ensureSpace(32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 22;
    };

    const addParagraph = (text: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, usableWidth);
      const height = lines.length * 16;
      ensureSpace(height);
      lines.forEach(line => {
        doc.text(line, margin, y);
        y += 16;
      });
    };

    const addKeyValue = (label: string, value: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      ensureSpace(18);
      doc.text(`${label}:`, margin, y);
      doc.text(value, pageWidth - margin, y, { align: 'right' });
      y += 18;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Property Rehabilitation & Appraisal Report', margin, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 24;

    sectionHeader('Property Overview');
    addKeyValue('Address', address || '—');
    addKeyValue('Investment Strategy', mode === 'rental' ? 'Rental (Buy & Hold)' : 'Flip (Resale)');
    if (sqft) addKeyValue('Square Footage', `${sqft.toLocaleString()} sqft`);
    if (price) addKeyValue('Purchase Price', formatCurrency(price));
    if (zdata.zestimate) addKeyValue('Zestimate®', formatCurrency(zdata.zestimate));
    if (zdata.rent) addKeyValue('Estimated Rent', formatCurrency(zdata.rent));
    if (zdata.zip) addKeyValue('ZIP Code', zdata.zip);
    if (!sqft && !price && !zdata.zestimate && !zdata.rent && !zdata.zip) {
      addParagraph('No property metrics were provided. Run an analysis or use Auto-fill from Zillow for richer insights.');
    }

    sectionHeader('Executive Summary');
    addParagraph(summary && summary !== '—' ? summary : 'No AI summary available yet. Run the analysis to generate findings.');

    sectionHeader('Contractor Estimate');
    const rehabValue = formatCurrency(rehab);
    addParagraph(`Recommended scope of work budgeted at ${rehabValue}. This figure is derived from detected condition issues and the reported square footage.`);
    const detectionHighlight = detections?.length
      ? detections
          .slice(0, 5)
          .map((d: any, idx: number) => {
            const label = (d.label || d.class || 'Item').toString();
            const confRaw = d.confidence ?? d.score;
            const confidenceText = typeof confRaw === 'number' ? ` (confidence ${formatPercent(confRaw)})` : '';
            return `${idx + 1}. ${label}${confidenceText}`;
          })
          .join('\n')
      : 'No visible damages were detected in the uploaded imagery. Include additional photos for a more comprehensive scope.';
    addParagraph(`Top visible scope items:\n${detectionHighlight}`);

    sectionHeader('Appraiser Notes');
    const arvValue = arv ? formatCurrency(arv) : 'N/A';
    const metricLabel = mode === 'rental' ? 'Projected Cap Rate' : 'Equity Spread';
    addKeyValue('After Repair Value (ARV)', arvValue);
    addKeyValue(metricLabel, metric ?? '—');
    const rentLine = zdata.rent ? `Stabilized monthly rent expected around ${formatCurrency(zdata.rent)}.` : '';
    const priceLine = price && arv ? `Projected equity after repairs: ${(arv - price).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.` : '';
    addParagraph([
      rentLine,
      priceLine,
      'Assumptions are based on publicly available valuation data and user-provided purchase economics. Field verification is recommended for final underwriting.'
        .trim(),
    ].filter(Boolean).join(' '));

    sectionHeader('Damage & Repair Log');
    if (detections?.length) {
      detections.forEach((d: any, index: number) => {
        ensureSpace(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${index + 1}. ${(d.label || d.class || 'Item').toString()}`, margin, y);
        const confidence = d.confidence ?? d.score;
        if (typeof confidence === 'number') {
          doc.setFont('helvetica', 'normal');
          doc.text(`Confidence: ${formatPercent(confidence)}`, pageWidth - margin, y, { align: 'right' });
        }
        y += 16;

        if (d.description) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(String(d.description), usableWidth);
          const blockHeight = lines.length * 14;
          ensureSpace(blockHeight);
          lines.forEach(line => {
            doc.text(line, margin + 12, y);
            y += 14;
          });
        }
      });
    } else {
      addParagraph('No repair items have been catalogued yet. Upload additional imagery or run the analyzer to populate this log.');
    }

    doc.save(`${normalizedAddress || 'property-report'}.pdf`);
  };

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
        <button
          className="btn"
          onClick={downloadReport}
        >
          Download Report
        </button>
      </div>
    </div>
  );
}
