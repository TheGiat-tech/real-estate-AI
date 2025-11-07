// Helper functions to resolve locality factor from State or MSA or ZIP.
// Uses relative imports to avoid alias/path config dependence.
// Note: Ensure tsconfig.json has "resolveJsonModule": true.

import rppStates from '../data/rpp_us_2023.json';
import rppMSA from '../data/rpp_msa_2023.sample.json'; // swap to full file when generated
import zipToMsa from '../data/zip_to_msa.sample.json'; // swap to full file when generated

export function getLocalityFactorByState(stateCode: string){
  const rec: any = (rppStates as any)[stateCode?.toUpperCase?.()] || null;
  return rec ? rec.rpp / 100 : 1;
}

export function getLocalityFactorByMSA(msaFips: string){
  const rec: any = (rppMSA as any)[msaFips] || null;
  return rec ? rec.rpp / 100 : 1;
}

export function getLocalityFactorByZIP(zip: string){
  const zip5 = (zip||'').toString().padStart(5,'0');
  const msa = (zipToMsa as any)[zip5];
  if(msa) return getLocalityFactorByMSA(msa);
  return 1; // Fallback to national average; optionally derive state and fallback
}

export function annotateLocality(source: 'state'|'msa'|'zip', key: string){
  if(source==='state'){
    const rec: any = (rppStates as any)[key?.toUpperCase?.()];
    return rec ? { level: 'state', code: key.toUpperCase(), rpp: rec.rpp, label: rec.state } : { level: 'state', code: key, rpp: 100 };
  }
  if(source==='msa'){
    const rec: any = (rppMSA as any)[key];
    return rec ? { level: 'msa', code: key, rpp: rec.rpp, label: rec.msa } : { level: 'msa', code: key, rpp: 100 };
  }
  if(source==='zip'){
    const zip5 = key.toString().padStart(5,'0');
    const msa = (zipToMsa as any)[zip5];
    if(msa){
      const rec: any = (rppMSA as any)[msa];
      if(rec) return { level: 'zip→msa', code: msa, rpp: rec.rpp, label: rec.msa };
    }
    return { level: 'zip', code: zip5, rpp: 100 };
  }
  return { level: 'unknown', code: key, rpp: 100 };
}
