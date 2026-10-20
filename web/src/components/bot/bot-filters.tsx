import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { LiveBot } from '@/lib/store'
import { GROUP_LABEL, statusGroup, type StatusGroup } from '@/lib/status'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type BotFilter = 'all' | StatusGroup

export function useBotFilter(bots: LiveBot[]) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BotFilter>('all')

  const counts = useMemo(() => {
    const c: Record<BotFilter, number> = { all: bots.length, online: 0, connecting: 0, stopped: 0, attention: 0 }
    for (const b of bots) c[statusGroup(b.status)]++
    return c
  }, [bots])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bots.filter((b) => {
      if (filter !== 'all' && statusGroup(b.status) !== filter) return false
      if (!q) return true
      return b.username.toLowerCase().includes(q) || b.world_name.toLowerCase().includes(q)
    })
  }, [bots, query, filter])

  // If the active filter becomes empty (e.g. the last stopped bot connected), fall back to all.
  const effectiveFilter: BotFilter = filter !== 'all' && counts[filter] === 0 ? 'all' : filter

  return { query, setQuery, filter: effectiveFilter, setFilter, counts, visible }
}

export function BotFilterBar({
  query,
  onQuery,
  filter,
  onFilter,
  counts,
  className,
}: {
  query: string
  onQuery: (q: string) => void
  filter: BotFilter
  onFilter: (f: BotFilter) => void
  counts: Record<BotFilter, number>
  className?: string
}) {
  const chips = (['all', 'online', 'connecting', 'stopped', 'attention'] as const).filter(
    (f) => f === 'all' || counts[f] > 0,
  )

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search bots or worlds…"
          aria-label="Search bots"
          className="h-9 pr-9 pl-9"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQuery('')}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {chips.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {chips.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                filter === f
                  ? 'border-primary/40 bg-primary/15 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f === 'all' ? 'All' : GROUP_LABEL[f]}
              <span className="tabular text-muted-foreground">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
