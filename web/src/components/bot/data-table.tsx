import { useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface DataRow {
  key: string | number
  cells: ReactNode[]
  /** Text used by the search box. Omit to make the row unsearchable. */
  search?: string
}

export interface DataColumn {
  label: string
  align?: 'left' | 'right'
  className?: string
}

/**
 * Compact table with a sticky header, optional search and an empty state.
 * Uses native scrolling so it works the same in cards and tabs.
 */
export function DataTable({
  columns,
  rows,
  empty,
  maxHeight = 'max-h-72',
  searchPlaceholder,
  toolbar,
}: {
  columns: DataColumn[]
  rows: DataRow[]
  empty: string
  maxHeight?: string
  searchPlaceholder?: string
  toolbar?: ReactNode
}) {
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => (r.search ?? '').toLowerCase().includes(term))
  }, [rows, q])

  return (
    <div className="flex flex-col gap-2.5">
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 pl-8"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className={cn('overflow-auto rounded-lg border border-border', maxHeight)}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  className={cn(
                    'h-9 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    c.className,
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {q ? 'Nothing matches your search' : empty}
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  {r.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-3 py-2 align-middle',
                        columns[i]?.align === 'right' && 'tabular text-right',
                        columns[i]?.className,
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
