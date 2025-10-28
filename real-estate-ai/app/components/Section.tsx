import { ReactNode } from 'react';
export default function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="hdr">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
