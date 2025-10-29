import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.ROBOFLOW_API_KEY) {
    return NextResponse.json({ error: 'ROBOFLOW_API_KEY is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address') ?? '';
  const mode = searchParams.get('mode') ?? 'rental';
  const sqft = searchParams.get('sqft') ?? '';
  const purchase_price = searchParams.get('purchase_price') ?? '';

  const form = await req.formData();
  const uploaded = form.getAll('image');
  const files = uploaded.filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'image missing' }, { status: 400 });
  }

  const u = new URL('https://detect.roboflow.com/property-rehab-arv-estimator');
  u.searchParams.set('api_key', process.env.ROBOFLOW_API_KEY);
  if (address) u.searchParams.set('address', address);
  if (mode) u.searchParams.set('mode', mode);
  if (sqft) u.searchParams.set('sqft', String(sqft));
  if (purchase_price) u.searchParams.set('purchase_price', String(purchase_price));

  const perImage: {
    index: number;
    filename: string;
    summary: string | null;
    detections: any[];
  }[] = [];

  for (const [index, file] of files.entries()) {
    const rfForm = new FormData();
    rfForm.append('image', file);

    let response: Response;
    try {
      response = await fetch(u.toString(), { method: 'POST', body: rfForm, cache: 'no-store' });
    } catch (error) {
      return NextResponse.json(
        { error: 'roboflow_request_failed', detail: (error as Error).message, imageIndex: index, filename: file.name },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: 'roboflow_failed', status: response.status, detail: text, imageIndex: index, filename: file.name },
        { status: 502 },
      );
    }

    const json = await response.json().catch(() => ({}));
    const rawDetections = (json.detections ?? json.predictions ?? []) as any[];
    const normalizedDetections = rawDetections.map(det => ({
      ...det,
      imageIndex: index,
      imageFilename: file.name,
    }));

    perImage.push({
      index,
      filename: file.name,
      summary: json.summary ?? null,
      detections: normalizedDetections,
    });
  }

  const allDetections = perImage.flatMap(entry => entry.detections);
  const combinedSummaries = perImage
    .map(entry => {
      if (!entry.summary) return null;
      const header = perImage.length > 1 ? `Image ${entry.index + 1} (${entry.filename})` : entry.filename;
      return header ? `${header}:\n${entry.summary}` : entry.summary;
    })
    .filter((value): value is string => Boolean(value));
  const summary = combinedSummaries.length > 0
    ? combinedSummaries.join('\n\n')
    : (perImage[0]?.summary ?? '—');

  return NextResponse.json({
    detections: allDetections,
    summary,
    perImage,
  });
}
