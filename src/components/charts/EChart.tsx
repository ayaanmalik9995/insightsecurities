import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { echarts, type EChartsOption } from './echarts';
import { useTheme } from '../../lib/theme';

export interface EChartHandle {
  instance: () => echarts.ECharts | null;
}

interface Props {
  option: EChartsOption;
  height: number | string;
  /** Short description read by screen readers. */
  ariaLabel: string;
  onEvents?: Record<string, (params: unknown) => void>;
  className?: string;
  /** Replace the whole option on update (use when series change shape). */
  replace?: boolean;
}

/**
 * Canvas chart that animates in once, the first time it scrolls into view, and
 * morphs quickly (250ms) when its data changes. Honors reduced motion.
 */
export const EChart = forwardRef<EChartHandle, Props>(function EChart({ option, height, ariaLabel, onEvents, className, replace = true }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [seen, setSeen] = useState(false);
  const { reducedMotion, palette } = useTheme();

  useImperativeHandle(ref, () => ({ instance: () => chart.current }), []);

  // Wait until visible before the first draw so the entrance animation is actually seen.
  useEffect(() => {
    if (!el.current) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el.current);
    // Draw off-screen charts once the page is idle anyway, so printing, find-in-page
    // and very fast scrolling never meet an empty chart.
    const idle = window.setTimeout(() => { setSeen(true); io.disconnect(); }, 3500);
    const onPrint = () => setSeen(true);
    window.addEventListener('beforeprint', onPrint);
    return () => { io.disconnect(); window.clearTimeout(idle); window.removeEventListener('beforeprint', onPrint); };
  }, []);

  useEffect(() => {
    if (!seen || !el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize({ animation: { duration: 0 } }));
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, [seen]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const first = !c.getOption();
    const base: EChartsOption = {
      animation: !reducedMotion,
      animationDuration: first ? 520 : 0,
      animationEasing: 'cubicOut',
      animationDurationUpdate: reducedMotion ? 0 : 260,
      animationEasingUpdate: 'cubicOut',
      textStyle: { fontFamily: palette.font, color: palette.muted },
      aria: { enabled: true, label: { description: ariaLabel } },
      ...option,
    };
    c.setOption(base, { notMerge: replace, lazyUpdate: false });
  }, [option, seen, reducedMotion, palette, ariaLabel, replace]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !onEvents) return;
    for (const [name, fn] of Object.entries(onEvents)) c.on(name, fn);
    return () => { for (const name of Object.keys(onEvents)) c.off(name); };
  }, [onEvents, seen]);

  return (
    <div className={className} style={{ height, width: '100%', position: 'relative' }}>
      <div ref={el} role="img" aria-label={ariaLabel} style={{ height: '100%', width: '100%' }} />
      {!seen && <div className="skeleton absolute inset-0 opacity-60" aria-hidden />}
    </div>
  );
});
