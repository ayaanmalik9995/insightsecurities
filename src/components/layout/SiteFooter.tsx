import { Link } from 'react-router';
import { Mail, MapPin, Phone } from 'lucide-react';
import type { Registry } from '../../lib/types';
import { fmtDate } from '../../lib/format';
import { Logo } from './SiteHeader';

/** Footer in the main site's structure: deep-green band, brand + link columns + contacts. */
export function SiteFooter({ registry }: { registry: Registry }) {
  const listed = registry.sectors.filter((s) => s.status !== 'dev');
  const live = listed.filter((s) => s.status === 'live');
  const asOf = live[0]?.asOf;
  return (
    <footer className="mt-20 bg-[#004015] text-white [[data-theme=dark]_&]:bg-[#06180e]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <Logo inverse />
          <p className="mt-5 max-w-[34ch] text-[14px] leading-relaxed text-white/80">
            Insight Securities is one of the premier financial institutions in Pakistan, providing equity brokerage and research services.
          </p>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">Sector insights</h2>
          <ul className="mt-4 space-y-2.5 text-[14px] text-white/80">
            {listed.map((s) => (
              <li key={s.slug}>
                {s.status === 'live' ? (
                  <Link to={`/${s.slug}`} className="transition-colors hover:text-white">{s.name}</Link>
                ) : (
                  <span className="text-white/50">{s.name} <span className="text-[11px]">(coming soon)</span></span>
                )}
              </li>
            ))}
            <li><Link to="/sectors" className="transition-colors hover:text-white">All sectors</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">About the data</h2>
          <ul className="mt-4 space-y-2.5 text-[14px] text-white/80">
            {live[0] && <li><Link to={`/${live[0].slug}/methodology`} className="transition-colors hover:text-white">Methodology and definitions</Link></li>}
            {asOf && <li className="num">Financials to {fmtDate(asOf.financials)}</li>}
            {asOf && <li className="num">Prices to {fmtDate(asOf.prices)}</li>}
            <li><a href="https://insightsec.com.pk/" className="transition-colors hover:text-white">insightsec.com.pk</a></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">Contacts</h2>
          <ul className="mt-4 space-y-4 text-[14px] text-white/80">
            <li className="flex gap-3"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-white/60" /><span>509 5th Floor Business &amp; Finance Center, I.I. Chundrigar Road, Karachi</span></li>
            <li className="flex gap-3"><Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-white/60" /><a href="tel:+922132462541" className="num hover:text-white">+92-21-32462541-44</a></li>
            <li className="flex gap-3"><Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-white/60" /><a href="mailto:info@insightsec.com.pk" className="hover:text-white">info@insightsec.com.pk</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1280px] px-4 py-6 text-center text-[13px] text-white/70 sm:px-6 lg:px-8">
          Copyright © {new Date().getFullYear()} Insight Securities. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
