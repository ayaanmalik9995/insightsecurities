import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 639px)';
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** True on phone-width screens, where charts simplify (fewer bars, no end labels). */
export function useNarrow() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
