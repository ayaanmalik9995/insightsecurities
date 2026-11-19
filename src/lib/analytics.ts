/**
 * Analytics hooks. Events are pushed to `window.dataLayer` (Google Tag Manager)
 * when it exists; nothing is sent otherwise and no IDs live in this code.
 * Wire GTM/GA4 at deployment and map these event names to GA4 events there.
 *
 *   insights_sector_switch   { sector, from_sector }
 *   insights_section_view    { sector, section }
 *   insights_company_view    { sector, ticker }
 *   insights_compare         { sector, tickers }
 *   insights_period_change   { sector, view, period }
 *   insights_download        { sector, item, format }
 *   insights_theme_toggle    { theme }
 */
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: `insights_${string}`, params: Params = {}) {
  try {
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...params });
    if (import.meta.env.DEV) console.debug('[analytics]', event, params);
  } catch {
    /* never let analytics break the page */
  }
}
