import { useLocation, useNavigate } from 'react-router';
import { useSector } from '../../lib/sector-context';

/**
 * DEVELOPMENT ONLY (rendered behind import.meta.env.DEV, never shipped):
 * flips the current page between the real sector data and the worst-case
 * stress-test workbook (data-src/stress), keeping the same sub-page.
 */
export function DevDataToggle() {
  const { registry, slug } = useSector();
  const loc = useLocation();
  const nav = useNavigate();
  const stress = registry.sectors.find((s) => s.status === 'dev');
  const demo = registry.defaultSector;
  if (!stress) return null;
  const rest = loc.pathname.split('/').slice(2).join('/');
  const go = (target: string) => nav(`/${target}${rest ? `/${rest}` : ''}${loc.search}`);
  const opts = [{ v: demo, l: 'Demo data' }, { v: stress.slug, l: 'Worst case' }];
  return (
    <div className="fixed bottom-[72px] left-1/2 z-50 flex -translate-x-1/2 gap-0.5 rounded-full bg-[#e5e5e5] p-0.5 font-[system-ui] text-[12px] shadow-md">
      {opts.map((o) => (
        <button key={o.v} type="button" onClick={() => go(o.v)} className={`rounded-full px-3 py-1 ${slug === o.v ? 'bg-white font-semibold text-black shadow-sm' : 'text-[#555]'}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
