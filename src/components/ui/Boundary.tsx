import { Component, type ReactNode } from 'react';

/** Local error boundary: one failed panel (e.g. a missing price file) never takes down the page. */
export class Boundary extends Component<{ fallback: (error: Error) => ReactNode; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

export function Unavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">{detail}</p>
    </div>
  );
}
