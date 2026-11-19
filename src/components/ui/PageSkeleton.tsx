import { Skeleton } from './controls';

/** Loading state shaped like the page it replaces, so nothing jumps when data lands. */
export function PageSkeleton({ inner }: { inner?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading insights">
      {!inner && (
        <>
          <div className="h-16 border-b border-line bg-surface sm:h-[72px]" />
          <div className="h-14 border-b border-line bg-surface" />
        </>
      )}
      <div className="bg-brand-deep">
        <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-12 sm:px-6 lg:px-8">
          <div className="skeleton h-4 w-48 !bg-none opacity-30" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="mt-5 h-10 w-full max-w-2xl rounded-md bg-white/10" />
          <div className="mt-3 h-10 w-3/4 max-w-xl rounded-md bg-white/10" />
        </div>
      </div>
      <div className="mx-auto -mt-12 max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-28" />
              <Skeleton className="mt-3 h-8 w-full" />
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
              <Skeleton className="mt-6 h-[260px] w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
