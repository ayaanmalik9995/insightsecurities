import type { ECharts } from 'echarts/core';
import { track } from './analytics';

export interface TableExport {
  /** File name without extension. */
  name: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  /** Source / as-of / disclaimer lines appended under the table. */
  footer: string[];
}

const safe = (s: string) => s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(v: string | number | null) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(t: TableExport, sector: string) {
  const lines = [t.title, '', t.columns.map(csvCell).join(','), ...t.rows.map((r) => r.map(csvCell).join(',')), '', ...t.footer.map(csvCell)];
  save(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${safe(t.name)}.csv`);
  track('insights_download', { sector, item: t.name, format: 'csv' });
}

export async function downloadXLSX(t: TableExport, sector: string) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  type C = { value: string | number; type?: typeof String | typeof Number; fontWeight?: 'bold'; wrap?: boolean } | null;
  const data: C[][] = [
    [{ value: t.title, fontWeight: 'bold' }],
    [],
    t.columns.map((c) => ({ value: c, fontWeight: 'bold' as const })),
    ...t.rows.map((r) => r.map((v) => (v === null || v === '' ? null : typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String }))),
    [],
    ...t.footer.map((f) => [{ value: f, type: String }]),
  ];
  const blob = (await writeXlsxFile(data as never, { columns: t.columns.map((_, i) => ({ width: i === 0 ? 34 : 16 })) } as never)) as unknown;
  if (blob instanceof Blob) save(blob, `${safe(t.name)}.xlsx`);
  else save(new Blob([blob as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safe(t.name)}.xlsx`);
  track('insights_download', { sector, item: t.name, format: 'xlsx' });
}

/** Chart image with its title, subtitle and source stamped on, so a shared PNG keeps its provenance. */
export async function downloadChartPNG(chart: ECharts, opts: { name: string; title: string; subtitle?: string; footer: string; background: string; ink: string; muted: string; sector: string }) {
  const scale = 2;
  const url = chart.getDataURL({ type: 'png', pixelRatio: scale, backgroundColor: opts.background });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const pad = 28 * scale;
  const titleH = 30 * scale, subH = opts.subtitle ? 22 * scale : 0, footH = 34 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2 + titleH + subH + footH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = opts.ink;
  ctx.font = `600 ${19 * scale}px "Source Serif 4", Georgia, serif`;
  ctx.fillText(opts.title, pad, pad + 20 * scale, canvas.width - pad * 2);
  if (opts.subtitle) {
    ctx.fillStyle = opts.muted;
    ctx.font = `400 ${12.5 * scale}px Inter, system-ui, sans-serif`;
    ctx.fillText(opts.subtitle, pad, pad + titleH + 14 * scale, canvas.width - pad * 2);
  }
  ctx.drawImage(img, pad, pad + titleH + subH);
  ctx.fillStyle = opts.muted;
  ctx.font = `400 ${11 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(opts.footer, pad, canvas.height - pad + 4 * scale, canvas.width - pad * 2);
  canvas.toBlob((b) => b && save(b, `${safe(opts.name)}.png`), 'image/png');
  track('insights_download', { sector: opts.sector, item: opts.name, format: 'png' });
}
