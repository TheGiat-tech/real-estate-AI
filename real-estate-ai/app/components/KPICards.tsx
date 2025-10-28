export default function KPICards({ rehab, arv, metric, rent }:{
  rehab?: number; arv?: number; metric?: string; rent?: number;
}) {
  const usd = (n?: number)=> n==null ? '—' : n.toLocaleString('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  return (
    <div className="kpi">
      <div className="card p-4"><div className="muted text-sm">Rehab Estimate</div><div className="text-2xl font-extrabold">{usd(rehab)}</div></div>
      <div className="card p-4"><div className="muted text-sm">ARV</div><div className="text-2xl font-extrabold">{usd(arv)}</div></div>
      <div className="card p-4"><div className="muted text-sm">ROI / Cap Rate</div><div className="text-2xl font-extrabold">{metric ?? '—'}</div></div>
      <div className="card p-4"><div className="muted text-sm">Rent (est.)</div><div className="text-2xl font-extrabold">{usd(rent)}</div></div>
    </div>
  );
}
