import './globals.css';
import { ReactNode } from 'react';
export const metadata = { title: 'Property Rehab & ARV Estimator', description: 'AI damage detection + rehab + ARV' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="container py-6">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="logo" className="h-8 w-8" />
            <div>
              <div className="text-xl font-bold">Property Rehab & ARV Estimator</div>
              <div className="muted text-sm">BRRRR workflow • Roboflow + Zillow + Supabase</div>
            </div>
          </div>
        </header>
        <main className="container pb-20">{children}</main>
        <footer className="container py-8 muted text-sm">© {new Date().getFullYear()} Real-Estate AI</footer>
      </body>
    </html>
  );
}
