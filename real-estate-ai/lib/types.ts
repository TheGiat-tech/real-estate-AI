export interface Box { x: number; y: number; width: number; height: number; }

export interface NormalizedDetection {
  label: string;
  confidence: number;
  box?: Box;
}

export type Mode = "rental" | "flip";

export interface DetectInput {
  // multipart/form-data
  image: File;                 // required
  address?: string;
  mode?: Mode;                 // default "rental"
  sqft?: number;
  purchase_price?: number;
  confidence?: number;         // 0..1 (default 0.35)
}

export interface LineItem {
  key: string;                 // e.g. "interior_paint"
  label: string;               // e.g. "Interior Paint"
  qty: number;                 // computed from sqft/rooms/flags
  unit: "sqft" | "lump_sum";
  unitCost: number;            // after multipliers
  subtotal: number;
  notes?: string;
}

export interface PricingBreakdown {
  locationFactor: number;      // 0.8..1.3 (state/city factor)
  finishGrade: Mode;           // rental/flip
  lineItems: LineItem[];
  subtotal: number;            // sum of lineItems
  contingencyPct: number;      // default 0.15
  contingency: number;         // subtotal * contingencyPct
  total: number;               // subtotal + contingency
}

export interface DetectOutput {
  detections: NormalizedDetection[];
  summary: string;
  rehab_cost: number | null;   // if null, we compute via PricingBreakdown.total
  arv: number | null;
  rent_estimate: number | null;
  cap_rate: number | null;
  raw: any;                    // raw Roboflow for debug
  pricing?: PricingBreakdown;  // our computed pricing (always attached)
  meta: {
    address?: string;
    mode: Mode;
    sqft?: number;
    purchase_price?: number;
    used_confidence: number;
    model_endpoint: string;
  };
}

export interface PdfRequest {
  header: {
    companyName: string;
    companyLine1?: string;
    email?: string;
    phone?: string;
  };
  client?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  data: DetectOutput;
}

/*
{
  "detections": [
    { "label": "mold", "confidence": 0.82, "box": { "x": 312, "y": 204, "width": 120, "height": 96 } },
    { "label": "crack", "confidence": 0.61, "box": { "x": 150, "y": 410, "width": 80, "height": 36 } }
  ],
  "summary": "Mold growth on lower right wall; small vertical crack detected.",
  "rehab_cost": 17850,
  "arv": 274000,
  "rent_estimate": 1850,
  "cap_rate": 6.2,
  "raw": { "predictions": ["… Roboflow raw …"] },
  "pricing": {
    "locationFactor": 0.98,
    "finishGrade": "rental",
    "lineItems": [
      {"key":"interior_paint","label":"Interior Paint","qty":1200,"unit":"sqft","unitCost":1.08,"subtotal":1296},
      {"key":"flooring_refresh","label":"Flooring Refresh","qty":1200,"unit":"sqft","unitCost":2.45,"subtotal":2940},
      {"key":"drywall_patch","label":"Drywall Patch & Prep","qty":180,"unit":"sqft","unitCost":0.78,"subtotal":140},
      {"key":"mold_remediation","label":"Mold Remediation","qty":120,"unit":"sqft","unitCost":1.18,"subtotal":142}
    ],
    "subtotal": 4518,
    "contingencyPct": 0.15,
    "contingency": 678,
    "total": 5196
  },
  "meta": {
    "address": "1093 Hibiscus St, FL 32233",
    "mode": "rental",
    "sqft": 1200,
    "purchase_price": 300000,
    "used_confidence": 0.35,
    "model_endpoint": "https://detect.roboflow.com/<MODEL>/<VERSION>"
  }
}
*/
