/** Period keys: quarters are "2026Q3" (calendar quarter end), years are "FY2025" (company's own fiscal year). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const isFY = (p: string) => p.startsWith('FY');
export const qYear = (p: string) => Number(p.slice(0, 4));
export const qNum = (p: string) => Number(p.slice(5));
export const qIndex = (p: string) => qYear(p) * 4 + qNum(p) - 1;
export const qFromIndex = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
export const qShift = (p: string, by: number) => qFromIndex(qIndex(p) + by);
export const qEndMonth = (p: string) => qNum(p) * 3; // 3, 6, 9, 12

/** "Q3 2026" */
export function periodLabel(p: string): string {
  if (isFY(p)) return p;
  return `Q${qNum(p)} ${qYear(p)}`;
}

/** Compact axis label: "Sep 26" for quarters, "FY25" for years. */
export function periodAxis(p: string): string {
  if (isFY(p)) return `FY${p.slice(4)}`;
  return `${MONTHS[qEndMonth(p) - 1]} ${String(qYear(p)).slice(2)}`;
}

/** "Sep 2026" */
export function periodMonth(p: string): string {
  if (isFY(p)) return p;
  return `${MONTHS[qEndMonth(p) - 1]} ${qYear(p)}`;
}

/** "Jul–Sep 2026" */
export function periodSpan(p: string): string {
  if (isFY(p)) return p;
  const m = qEndMonth(p);
  return `${MONTHS[m - 3]}–${MONTHS[m - 1]} ${qYear(p)}`;
}

/** Company's own fiscal quarter for a calendar quarter: "1QFY27" for Sep-2026 at a June year-end. */
export function fiscalQuarter(p: string, fyEndMonth: number): string {
  const m = qEndMonth(p);
  const y = qYear(p);
  const fy = m > fyEndMonth ? y + 1 : y;
  const startMonth = (fyEndMonth % 12) + 1; // first month of FY
  const monthsIn = ((m - startMonth + 12) % 12) + 1;
  const q = Math.ceil(monthsIn / 3);
  return `${q}QFY${String(fy).slice(2)}`;
}

/** Fiscal year end, e.g. FY2025 at June → "Jun 2025". */
export function fyEndLabel(fy: string, fyEndMonth: number): string {
  return `${MONTHS[fyEndMonth - 1]} ${fy.slice(2)}`;
}

export function fyMonthName(m: number) {
  return MONTHS_LONG[m - 1] ?? String(m);
}

/** "12 months to Sep 2026" */
export function ttmLabel(p: string): string {
  return `12 months to ${periodMonth(p)}`;
}

export function dayToDate(day: number) {
  return new Date(day * 86400000);
}

export function dayLabel(day: number, withYear = true) {
  const d = dayToDate(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
}
