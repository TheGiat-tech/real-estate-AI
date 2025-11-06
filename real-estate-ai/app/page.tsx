"use client";
import { useRef, useState } from "react";
import type { DetectOutput } from "@/lib/types";

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState<string>("");
  const [data, setData] = useState<DetectOutput | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      alert("Pick an image");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", f);
      fd.append("address", "1093 Hibiscus St, FL 32233");
      fd.append("mode", "rental");
      fd.append("sqft", "1200");
      fd.append("purchase_price", "300000");

      const r = await fetch("/api/detect", { method: "POST", body: fd });
      const j = await r.json();
      setJson(JSON.stringify(j, null, 2));
      setData(j);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!data) {
      alert("Analyze first");
      return;
    }
    const req = {
      header: {
        companyName: "Real Estate AI Contractors",
        companyLine1: "123 Market Street, Suite 400, Springfield, USA",
        email: "estimates@realestate.ai",
        phone: "(555) 010-1000",
      },
      client: { name: "Property Owner" },
      data,
    };
    const r = await fetch("/api/report", {
      method: "POST",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rehab-estimate.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>Property Rehab &amp; ARV – MVP</h1>
      <input type="file" ref={fileRef} accept="image/*" />
      <button onClick={analyze} disabled={busy} style={{ padding: "10px 14px", marginLeft: 10 }}>
        {busy ? "Analyzing…" : "Analyze"}
      </button>
      <button onClick={downloadPdf} disabled={!data} style={{ padding: "10px 14px", marginLeft: 10 }}>
        Download PDF
      </button>
      <pre
        style={{
          background: "#0b1020",
          color: "#e6edf3",
          padding: 12,
          borderRadius: 12,
          marginTop: 16,
          overflow: "auto",
          maxHeight: 420,
        }}
      >
        {json || "// Run Analyze to see full DetectOutput JSON"}
      </pre>
    </main>
  );
}
