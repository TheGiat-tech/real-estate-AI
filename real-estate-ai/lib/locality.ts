// Helper functions to resolve locality factor from State or MSA or ZIP.
// Uses relative imports to avoid alias/path config dependence.
// Note: Ensure tsconfig.json has "resolveJsonModule": true.

import rppStates from '../data/rpp_us_2023.json';
import rppMSA from '../data/rpp_msa_2023.sample.json'; // swap to full file when generated
import zipToMsa from '../data/zip_to_msa.sample.json'; // swap to full file when generated

interface RPPRecord {
  state?: string;
  msa?: string;
  rpp: number;
  housing: number;
  goods: number;
  services: number;
}

type RPPStateData = Record<string, RPPRecord>;
type RPPMSAData = Record<string, RPPRecord>;
type ZIPToMSAData = Record<string, string>;

export function getLocalityFactorByState(stateCode: string){
  const rec = (rppStates as RPPStateData)[stateCode?.toUpperCase?.()] || null;
  return rec ? rec.rpp / 100 : 1;
}

export function getLocalityFactorByMSA(msaFips: string){
  const rec = (rppMSA as RPPMSAData)[msaFips] || null;
  return rec ? rec.rpp / 100 : 1;
}

export function getLocalityFactorByZIP(zip: string){
  if (!zip) return 1; // Return default factor if zip is not provided
  const zip5 = zip.toString().padStart(5,'0');
  const msa = (zipToMsa as ZIPToMSAData)[zip5];
  if(msa) return getLocalityFactorByMSA(msa);
  return 1; // Fallback to national average; optionally derive state and fallback
}

export function annotateLocality(source: 'state'|'msa'|'zip', key: string){
  if(source==='state'){
    const rec = (rppStates as RPPStateData)[key?.toUpperCase?.()];
    return rec ? { level: 'state', code: key.toUpperCase(), rpp: rec.rpp, label: rec.state } : { level: 'state', code: key, rpp: 100 };
  }
  if(source==='msa'){
    const rec = (rppMSA as RPPMSAData)[key];
    return rec ? { level: 'msa', code: key, rpp: rec.rpp, label: rec.msa } : { level: 'msa', code: key, rpp: 100 };
  }
  if(source==='zip'){
    const zip5 = key.toString().padStart(5,'0');
    const msa = (zipToMsa as ZIPToMSAData)[zip5];
    if(msa){
      const rec = (rppMSA as RPPMSAData)[msa];
      if(rec) return { level: 'zip→msa', code: msa, rpp: rec.rpp, label: rec.msa };
    }
    return { level: 'zip', code: zip5, rpp: 100 };
  }
  return { level: 'unknown', code: key, rpp: 100 };
}
