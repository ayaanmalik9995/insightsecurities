import { Link } from 'react-router';
import { ArrowLeft, Clock3, Compass } from 'lucide-react';
import type { SectorEntry } from '../lib/types';
import { useEffect } from 'react';

export function ComingSoon({ entry }: { entry: SectorEntry }) {
  useEffect(() => { document.title = `${entry.name}: coming soon | Insight Securities Insights`; }, [entry.name]);
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-8">
      <div className="max-w-xl">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink"><Clock3 aria-hidden className="size-5" /></span>
        <h1 className="serif mt-6 text-[34px] font-semibold leading-tight text-ink">{entry.name} insights are on the way</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{entry.description} This sector goes live as soon as its research workbook is published; the pages, charts and tables will look exactly like the live sectors.</p>
        <Link to="/sectors" className="mt-8 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold text-ink transition-colors hover:border-line-strong">
          <ArrowLeft aria-hidden className="size-4" /> See live sectors
        </Link>
      </div>
    </div>
  );
}

export function NotFound({ standalone }: { standalone?: boolean }) {
  useEffect(() => { document.title = 'Page not found | Insight Securities Insights'; }, []);
  return (
    <div className={`mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 ${standalone ? 'py-32' : 'py-24'}`}>
      <div className="max-w-xl">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-3 text-muted"><Compass aria-hidden className="size-5" /></span>
        <h1 className="serif mt-6 text-[34px] font-semibold leading-tight text-ink">This page is not in the insights</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">The link may be out of date, or the company may not be covered in this sector. Use the sector pages or the company search to find it.</p>
        <Link to="/" className="mt-8 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90">
          <ArrowLeft aria-hidden className="size-4" /> Back to insights
        </Link>
      </div>
    </div>
  );
}
