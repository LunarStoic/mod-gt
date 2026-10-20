import { useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { LayoutGrid, Plus, SearchX } from 'lucide-react'
import { botsAtom, selectedBotIdAtom } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common'
import { addBotOpenAtom } from './add-bot-dialog'
import { BotFilterBar, useBotFilter } from './bot-filters'
import { BotRow } from './bot-items'

/** Compact bot switcher shown beside the detail view on large screens. */
export function BotPanel() {
  const botsMap = useAtomValue(botsAtom)
  const [selectedId, setSelectedId] = useAtom(selectedBotIdAtom)
  const setAddOpen = useSetAtom(addBotOpenAtom)

  const bots = useMemo(() => [...botsMap.values()], [botsMap])
  const { query, setQuery, filter, setFilter, counts, visible } = useBotFilter(bots)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card/40 xl:w-80">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-2 rounded-md text-sm font-semibold transition-colors hover:text-primary"
        >
          <LayoutGrid className="size-4" />
          All bots
          <span className="tabular rounded-full bg-muted px-2 text-xs leading-5 font-medium text-muted-foreground">
            {bots.length}
          </span>
        </button>
        <Hint label="Add bot">
          <Button size="icon-sm" onClick={() => setAddOpen(true)} aria-label="Add bot">
            <Plus />
          </Button>
        </Hint>
      </div>

      <div className="shrink-0 p-3">
        <BotFilterBar
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={setFilter}
          counts={counts}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title="No bots match" className="py-8" />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((bot) => (
              <li key={bot.id}>
                <BotRow
                  bot={bot}
                  selected={bot.id === selectedId}
                  onSelect={() => setSelectedId(bot.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
