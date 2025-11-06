// Build a compact contractor-style PDF from DetectOutput using pdf-lib (no heavy React-PDF).
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PdfRequest, LineItem } from "@/lib/types";

export const runtime = "nodejs";

function money(n?: number | null) {
  return n == null || Number.isNaN(n) ? "—" : `$${Math.round(n).toLocaleString()}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PdfRequest;
    const { header, client, data } = body;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 750;
    const draw = (text: string, x: number, fs = 11, b = false) => {
      const f = b ? bold : font;
      page.drawText(text, { x, y, size: fs, font: f, color: rgb(0, 0, 0) });
      y -= fs + 4;
    };

    // Header
    draw(header.companyName ?? "Real Estate AI Contractors", 36, 18, true);
    if (header.companyLine1) draw(header.companyLine1, 36, 10);
    const contact = [header.email, header.phone].filter(Boolean).join(" • ");
    if (contact) draw(contact, 36, 10);

    y -= 8;
    page.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;

    draw("Appraisal & Rehab Estimate", 36, 13, true);
    draw(`Generated: ${new Date().toLocaleString()}`, 36, 9);

    // Property/Client boxes
    const left = y;
    draw("Property", 36, 12, true);
    draw(`Address: ${data.meta.address ?? "—"}`, 36);
    draw(`Mode: ${data.meta.mode}`, 36);
    draw(`Square Feet: ${data.meta.sqft ?? "—"}`, 36);

    y = left;
    draw("Client", 320, 12, true);
    draw(`Name: ${client?.name ?? "—"}`, 320);
    draw(`Email: ${client?.email ?? "—"}`, 320);
    draw(`Phone: ${client?.phone ?? "—"}`, 320);

    y -= 6;
    page.drawLine({ start: { x: 36, y }, end: { x: 576, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 10;

    // KPIs
    draw(`Rehab Estimate: ${money(data.rehab_cost ?? data.pricing?.total)}`, 36, 12, true);
    draw(`ARV (Projected): ${money(data.arv)}`, 236, 12, true);
    draw(`Cap Rate: ${data.cap_rate != null ? `${data.cap_rate}%` : "—"}`, 436, 12, true);

    y -= 6;
    draw("Summary", 36, 12, true);
    draw(data.summary || "This report summarizes detected issues and a scope of work suitable for the selected finish grade.", 36);

    // Detections
    y -= 2;
    draw("AI Detections", 36, 12, true);
    if (!data.detections?.length) draw("No visible damages were detected in the provided images.", 36);
    else data.detections.slice(0, 6).forEach((d) => draw(`• ${d.label} (${(d.confidence * 100).toFixed(0)}%)`, 36));

    // Scope/Line Items
    y -= 2;
    draw("Scope of Work & Line Items", 36, 12, true);
    const items: LineItem[] = data.pricing?.lineItems ?? [];
    if (!items.length) draw("No scope items available.", 36);
    else {
      draw("Category                          Qty      Unit      Unit Cost      Subtotal", 36, 10, true);
      items.forEach((li) => {
        const row = `${li.label.padEnd(30)}  ${String(li.qty).padStart(6)}   ${li.unit.padEnd(8)}   ${money(li.unitCost).padEnd(10)}   ${money(li.subtotal)}`;
        draw(row, 36, 10);
      });
      draw(`Subtotal: ${money(data.pricing?.subtotal)}`, 400, 11, true);
      draw(`Contingency (${Math.round((data.pricing?.contingencyPct ?? 0) * 100)}%): ${money(data.pricing?.contingency)}`, 400, 11, true);
      draw(`Estimated Rehab Total: ${money(data.pricing?.total)}`, 400, 12, true);
    }

    y -= 10;
    draw("Contractor Signature: ____________________", 36, 11);
    draw("Client Signature: ____________________", 350, 11);
    draw(`Date: ${new Date().toLocaleDateString()}`, 36, 10);

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rehab-estimate.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
