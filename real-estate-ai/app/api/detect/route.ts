import { NextResponse } from "next/server";
import { computePricing } from "@/lib/pricing";
import type { DetectOutput, NormalizedDetection, Box, Mode } from "@/lib/types";

export const runtime = "nodejs";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function rfUrl(params: Record<string, string | number | undefined>) {
  const base = env("ROBOFLOW_ENDPOINT");
  const key = env("ROBOFLOW_API_KEY");
  const u = new URL(base);
  u.searchParams.set("api_key", key);
  u.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const image = form.get("image") as File | null;
    if (!image) return NextResponse.json({ error: "image is required" }, { status: 400 });

    const address = (form.get("address") ?? "") as string;
    const mode = ((form.get("mode") ?? "rental") as Mode);
    const sqft = Number(form.get("sqft") ?? 0) || undefined;
    const purchase = Number(form.get("purchase_price") ?? 0) || undefined;
    const confidence = Math.max(0, Math.min(1, Number(form.get("confidence") ?? 0.35)));

    const url = rfUrl({ address, mode, sqft, purchase_price: purchase, confidence });
    const fd = new FormData();
    fd.append("file", image, (image as any).name || "upload.jpg");

    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) {
      return NextResponse.json({ error: `Roboflow ${res.status}`, details: await res.text() }, { status: 502 });
    }
    const rf = await res.json();

    const preds = (rf?.predictions ?? rf?.detections ?? []) as any[];
    const dets: NormalizedDetection[] = preds
      .map((p) => {
        const c = p.confidence ?? p.score ?? 0;
        const b: Box | undefined = p.box
          ? { x: p.box.x, y: p.box.y, width: p.box.width, height: p.box.height }
          : (p.x != null && p.width != null
              ? { x: p.x, y: p.y, width: p.width, height: p.height }
              : undefined);
        return { label: p.class ?? p.label ?? "issue", confidence: c, box: b };
      })
      .filter((d) => d.confidence >= confidence);

    const hasMold = dets.some((d) => /mold/i.test(d.label));
    const hasRoof = dets.some((d) => /roof/i.test(d.label));
    const hasCrack = dets.some((d) => /crack/i.test(d.label));

    const pricing = computePricing({
      sqft,
      mode,
      address,
      hasMold,
      hasRoof,
      hasCrack,
    });

    const out: DetectOutput = {
      detections: dets,
      summary: rf?.summary ?? "",
      rehab_cost: rf?.rehab_cost ?? pricing.total,
      arv: rf?.arv ?? null,
      rent_estimate: rf?.rent_estimate ?? null,
      cap_rate: rf?.cap_rate ?? null,
      raw: rf,
      pricing,
      meta: {
        address: address || undefined,
        mode,
        sqft,
        purchase_price: purchase,
        used_confidence: confidence,
        model_endpoint: process.env.ROBOFLOW_ENDPOINT!,
      },
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
