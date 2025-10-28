type Row = { type: string; confidence?: number|string; location?: string };
export default function DamageTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left p-3">Type</th>
            <th className="text-left p-3">Confidence</th>
            <th className="text-left p-3">Location</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-3 muted" colSpan={3}>—</td></tr>
          ) : rows.map((r,i)=>(
            <tr key={i} className="border-t border-white/10">
              <td className="p-3">{r.type}</td>
              <td className="p-3">{r.confidence ?? ''}</td>
              <td className="p-3">{r.location ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
