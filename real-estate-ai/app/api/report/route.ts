import PDFDocument from "pdfkit";
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // IMPORTANT: not Edge

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type LineItem = { category: string; notes?: string; qty?: number; unit?: string; unitCost?: number; subtotal?: number };

type Payload = {
  company?: { name?: string; email?: string; phone?: string; address?: string; logoUrl?: string };
  client?: { name?: string; email?: string; phone?: string };
  address: string;
  mode: "rental" | "flip";
  sqft?: number;
  price?: number;
  zestimate?: number;
  rent?: number;
  zip?: string;
  detections?: Array<{ label: string; confidence?: number; box?: any; note?: string }>;
  summary?: string;
  rehab?: number;
  arv?: number;
  metric?: string; // cap-rate% or profit$
  lineItems?: LineItem[];
  disclaimer?: string;
  signatures?: { contractorName?: string; clientName?: string; date?: string };
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Payload;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // Header
  if (body.company?.logoUrl) {
    try { doc.image(body.company.logoUrl, 48, 40, { width: 90 }); } catch {}
  }
  doc
    .fontSize(18).text(body.company?.name ?? "Property Rehab & ARV Estimator", 150, 40, { align: "left" })
    .moveDown(0.3)
    .fontSize(10)
    .fillColor("#444")
    .text(body.company?.address ?? "", 150)
    .text([body.company?.email, body.company?.phone].filter(Boolean).join(" · "), 150)
    .moveTo(48, 100).lineTo(547, 100).strokeColor("#e5e7eb").stroke().fillColor("#000");

  // Title + meta
  doc.fontSize(16).text("Appraisal & Rehab Estimate", 48, 115);
  doc.fontSize(10).fillColor("#666").text(`Generated: ${new Date().toLocaleString()}`);

  // Property + client
  const leftX = 48, rightX = 320, y0 = 150;
  doc.fillColor("#000").fontSize(12).text("Property", leftX, y0);
  doc.fontSize(10).fillColor("#333")
    .text(`Address: ${body.address}`, leftX, y0 + 16)
    .text(`Mode: ${body.mode}`, leftX, y0 + 30)
    .text(`Square Feet: ${body.sqft ?? "—"}`, leftX, y0 + 44)
    .text(`ZIP: ${body.zip ?? "—"}`, leftX, y0 + 58);

  doc.fillColor("#000").fontSize(12).text("Client", rightX, y0);
  doc.fontSize(10).fillColor("#333")
    .text(`Name: ${body.client?.name ?? "—"}`, rightX, y0 + 16)
    .text(`Email: ${body.client?.email ?? "—"}`, rightX, y0 + 30)
    .text(`Phone: ${body.client?.phone ?? "—"}`, rightX, y0 + 44);

  // KPI boxes
  const kpiY = y0 + 90;
  const box = (label: string, value: string, x: number) => {
    doc.roundedRect(x, kpiY, 155, 54, 8).fillOpacity(0.04).fill("#3b82f6").fillOpacity(1).strokeColor("#e5e7eb").stroke();
    doc.fillColor("#666").fontSize(9).text(label, x + 10, kpiY + 8);
    doc.fillColor("#000").fontSize(14).text(value, x + 10, kpiY + 24);
  };
  box("Rehab Estimate", fmt(body.rehab ?? 0), 48);
  box("ARV (Projected)", fmt(body.arv ?? 0), 211);
  box(body.mode === "rental" ? "Cap Rate" : "Profit (flip)", body.metric ?? "—", 374);

  // Summary
  doc.moveDown().fillColor("#000").fontSize(12).text("Summary", 48, kpiY + 70);
  doc.fontSize(10).fillColor("#333").text(
    body.summary ||
      "This report summarizes visible damages and a scope of work appropriate for rental-quality finish (unless specified otherwise). Pricing reflects current averages and may vary by market, material grade, and labor availability."
  );

  // Detections table
  doc.moveDown().fillColor("#000").fontSize(12).text("AI Detections");
  const dets = body.detections ?? [];
  if (!dets.length) {
    doc.fontSize(10).fillColor("#777").text("No visible damages were detected in the provided images.");
  } else {
    const startY = doc.y + 6;
    const col = [48, 260, 430];
    doc.strokeColor("#e5e7eb").moveTo(48, startY).lineTo(547, startY).stroke();
    doc.fontSize(9).fillColor("#555")
      .text("Type", col[0], startY + 6)
      .text("Confidence", col[1], startY + 6)
      .text("Notes/Location", col[2], startY + 6);
    doc.moveTo(48, startY + 22).lineTo(547, startY + 22).stroke();

    let y = startY + 30;
    dets.forEach((d) => {
      doc.fillColor("#000").fontSize(10)
        .text(d.label ?? "—", col[0], y)
        .text(d.confidence != null ? (d.confidence * 100).toFixed(0) + "%" : "—", col[1], y)
        .text(d.note ?? "", col[2], y, { width: 547 - col[2] });
      y += 16;
      if (y > 740) { doc.addPage(); y = 60; }
    });
  }

  // Line items (scope)
  doc.moveDown().fillColor("#000").fontSize(12).text("Scope of Work & Line Items");
  const rows: LineItem[] = (body.lineItems?.length ? body.lineItems : [
    { category: "Interior Paint", qty: body.sqft ?? 0, unit: "sqft", unitCost: 1.8 },
    { category: "Flooring (LVP/Carpet mix)", qty: body.sqft ? Math.round((body.sqft * 0.7)) : undefined, unit: "sqft", unitCost: 2.6 },
    { category: "Bathroom Refresh", qty: 1, unit: "each", unitCost: 1800 },
    { category: "Kitchen Touch-up", qty: 1, unit: "each", unitCost: 1500 },
  ]).map(r => ({ ...r, subtotal: r.subtotal ?? ((r.qty ?? 1) * (r.unitCost ?? 0)) }));

  // table header
  const headerY = doc.y + 6;
  doc.strokeColor("#e5e7eb").moveTo(48, headerY).lineTo(547, headerY).stroke();
  doc.fontSize(9).fillColor("#555")
     .text("Category", 48, headerY + 6)
     .text("Qty", 280, headerY + 6)
     .text("Unit", 320, headerY + 6)
     .text("Unit Cost", 360, headerY + 6)
     .text("Subtotal", 450, headerY + 6);
  doc.moveTo(48, headerY + 22).lineTo(547, headerY + 22).stroke();

  let y = headerY + 30;
  let total = 0;
  rows.forEach(r => {
    total += r.subtotal ?? 0;
    doc.fillColor("#000").fontSize(10)
      .text(r.category, 48, y, { width: 220 })
      .text(r.qty != null ? String(r.qty) : "—", 280, y)
      .text(r.unit ?? "—", 320, y)
      .text(r.unitCost != null ? fmt(r.unitCost) : "—", 360, y)
      .text(fmt(r.subtotal ?? 0), 450, y);
    y += 16;
    if (y > 730) { doc.addPage(); y = 60; }
  });

  const contingency = Math.round(total * 0.15);
  const grand = total + contingency;
  doc.moveDown().fontSize(10).fillColor("#333")
     .text(`Subtotal: ${fmt(total)}`)
     .text(`Contingency (15%): ${fmt(contingency)}`)
     .fontSize(12).fillColor("#000").text(`Estimated Rehab Total: ${fmt(grand)}`);

  // Financials
  doc.moveDown().fontSize(12).fillColor("#000").text("Financial Summary");
  const zv = body.zestimate ?? body.arv ?? 0;
  const arv = body.arv ?? Math.round(zv);
  doc.fontSize(10).fillColor("#333")
     .text(`Purchase Price: ${fmt(body.price ?? 0)}`)
     .text(`ARV (Projected): ${fmt(arv)}`)
     .text(body.mode === "rental" ? `Cap Rate: ${body.metric ?? "—"}` : `Profit (Flip): ${body.metric ?? "—"}`);

  // Disclaimer & signatures
  doc.moveDown().fontSize(9).fillColor("#666").text(
    body.disclaimer ??
      "This estimate is provided for planning purposes only. Final pricing subject to site verification, permit requirements, material selections, and contractor availability."
  , { width: 500 });

  doc.moveDown(1.2).fillColor("#000").fontSize(10)
     .text("Contractor Signature: ____________________", 48)
     .text("Client Signature: ________________________", 300)
     .moveDown(0.3)
     .fontSize(9).fillColor("#666")
     .text(`Date: ${body.signatures?.date ?? new Date().toLocaleDateString()}`, 48);

  doc.end();
  const buf = await done;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="appraisal_${Date.now()}.pdf"`
    }
  });
}
