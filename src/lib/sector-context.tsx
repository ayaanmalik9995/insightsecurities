import { createContext, useContext, type ReactNode } from 'react';
import type { SectorBundle } from './data';
import type { Registry } from './types';
import { fmtDate } from './format';

interface Ctx {
  registry: Registry;
  bundle: SectorBundle;
  slug: string;
}

const SectorCtx = createContext<Ctx | null>(null);

export function SectorProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <SectorCtx.Provider value={value}>{children}</SectorCtx.Provider>;
}

export function useSector() {
  const c = useContext(SectorCtx);
  if (!c) throw new Error('useSector outside SectorProvider');
  return c;
}

/** "Source: Insight Securities research (PSX_Pharma_Model.xlsx) · Financials to 30 Sep 2026 · Prices to 10 Nov 2026" */
export function sourceLine(b: SectorBundle, opts: { prices?: boolean; financials?: boolean } = { prices: true, financials: true }) {
  const parts = ['Source: Insight Securities research, company financial statements'];
  if (opts.financials !== false) parts.push(`financials to ${fmtDate(b.meta.asOf.financials)}`);
  if (opts.prices) parts.push(`prices to ${fmtDate(b.meta.asOf.prices)}`);
  return parts.join(' · ');
}
