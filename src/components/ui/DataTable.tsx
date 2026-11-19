import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export interface Column<R> {
  key: string;
  header: ReactNode;
  /** Plain header text for exports. */
  exportHeader?: string;
  /** Unit line under the header ("PKR mn", "%"). */
  sub?: string;
  align?: 'left' | 'right' | 'center';
  sticky?: boolean;
  minWidth?: number;
  render: (row: R) => ReactNode;
  sortValue?: (row: R) => number | string | null;
  exportValue?: (row: R) => string | number | null;
  cellClass?: (row: R) => string;
  cellStyle?: (row: R) => CSSProperties | undefined;
  title?: (row: R) => string | undefined;
}

interface Props<R> {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  footerRows?: { key: string; cells: Record<string, ReactNode>; label: ReactNode }[];
  dense?: boolean;
  onRowClick?: (row: R) => void;
  rowClass?: (row: R) => string;
  maxHeight?: number;
}

/** Sortable table: right-aligned tabular numerals, sticky first column, missing values always last. */
export function DataTable<R>({ columns, rows, rowKey, caption, initialSort, footerRows, dense, onRowClick, rowClass, maxHeight }: Props<R>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const withV = rows.map((r) => ({ r, v: col.sortValue!(r) }));
    withV.sort((a, b) => {
      if (a.v === null || a.v === undefined) return 1;
      if (b.v === null || b.v === undefined) return -1;
      const d = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v));
      return sort.dir === 'asc' ? d : -d;
    });
    return withV.map((x) => x.r);
  }, [rows, sort, columns]);

  const pad = dense ? 'px-3 py-2' : 'px-3.5 py-2.5';
  return (
    <div className="relative overflow-auto rounded-lg border border-line" style={maxHeight ? { maxHeight } : undefined} tabIndex={0} role="region" aria-label={caption}>
      <table className="data-table w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[3] bg-surface">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              const align = c.align ?? 'right';
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`${c.sticky ? 'sticky-col' : ''} border-b border-line-strong bg-surface align-bottom font-semibold text-ink-2 ${pad} ${
                    align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
                  }`}
                  style={{ minWidth: c.minWidth }}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: typeof c.sortValue!(rows[0]) === 'string' ? 'asc' : 'desc' }))}
                      className={`group inline-flex items-end gap-1 text-[12px] leading-tight hover:text-ink ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'}`}
                    >
                      <span>
                        {c.header}
                        {c.sub && <span className="block text-[10.5px] font-normal text-faint">{c.sub}</span>}
                      </span>
                      <Icon aria-hidden className={`mb-0.5 size-3 shrink-0 ${active ? 'text-brand-ink' : 'text-faint opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  ) : (
                    <span className="text-[12px] leading-tight">
                      {c.header}
                      {c.sub && <span className="block text-[10.5px] font-normal text-faint">{c.sub}</span>}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`group/row border-b border-line last:border-b-0 ${onRowClick ? 'cursor-pointer' : ''} ${rowClass?.(r) ?? ''}`}
            >
              {columns.map((c) => {
                const align = c.align ?? 'right';
                return (
                  <td
                    key={c.key}
                    title={c.title?.(r)}
                    className={`${c.sticky ? 'sticky-col' : ''} ${pad} ${align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'num text-right'} whitespace-nowrap transition-colors group-hover/row:bg-surface-2 ${c.cellClass?.(r) ?? ''}`}
                    style={c.cellStyle?.(r)}
                  >
                    {c.render(r)}
                  </td>
                );
              })}
            </tr>
          ))}
          {footerRows?.map((f) => (
            <tr key={f.key} className="border-t border-line-strong bg-surface-2">
              {columns.map((c, i) => (
                <td key={c.key} className={`${c.sticky ? 'sticky-col !bg-surface-2' : ''} ${pad} font-semibold text-ink-2 ${i === 0 ? 'text-left' : 'num text-right'}`}>
                  {i === 0 ? f.label : f.cells[c.key] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tableExport<R>(columns: Column<R>[], rows: R[]) {
  return {
    columns: columns.map((c) => `${c.exportHeader ?? (typeof c.header === 'string' ? c.header : c.key)}${c.sub ? ` (${c.sub})` : ''}`),
    rows: rows.map((r) => columns.map((c) => (c.exportValue ? c.exportValue(r) : null))),
  };
}
