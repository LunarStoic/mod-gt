import { useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Bot, CircleAlert, Gem, Loader2, PlugZap, Plus, SearchX, Wifi, X } from 'lucide-react'
import { botsAtom, selectedBotIdAtom } from '@/lib/store'
import { statusGroup } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader, StatCard, compact } from '@/components/common'
import { addBotOpenAtom } from './add-bot-dialog'
import { BotFilterBar, useBotFilter } from './bot-filters'
import { BotCard } from './bot-items'
import {
  STAGGER_GAP_MS,
  cancelStagger,
  reconnectStaggered,
  staggerAtom,
} from './bot-actions'

export function FleetOverview() {
  const botsMap = useAtomValue(botsAtom)
  const setSelected = useSetAtom(selectedBotIdAtom)
  const setAddOpen = useSetAtom(addBotOpenAtom)
  const stagger = useAtomValue(staggerAtom)

  const bots = useMemo(() => [...botsMap.values()], [botsMap])
  const { query, setQuery, filter, setFilter, counts, visible } = useBotFilter(bots)

  const stoppedIds = useMemo(
    () => bots.filter((b) => b.status === 'stopped').map((b) => b.id),
    [bots],
  )
  const totalGems = useMemo(() => bots.reduce((s, b) => s + (b.gems || 0), 0), [bots])
  const pings = bots.filter((b) => b.ping_ms > 0)
  const avgPing = pings.length ? Math.round(pings.reduce((s, b) => s + b.ping_ms, 0) / pings.length) : 0

  const attention = bots.filter((b) => statusGroup(b.status) === 'attention').length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <PageHeader
          icon={Bot}
          title="Bots"
          description={
            bots.length
              ? `${counts.online} of ${bots.length} online`
              : 'Add a bot to get started'
          }
          actions={
            <>
              {stagger.running ? (
                <Button variant="outline" onClick={cancelStagger}>
                  <Loader2 className="animate-spin" />
                  Starting {stagger.done}/{stagger.total}
                  <X className="ml-1 size-3.5 opacity-60" aria-label="Cancel" />
                </Button>
              ) : (
                stoppedIds.length > 0 && (
                  <Button
                    variant="outline"
                    title={`Reconnects one bot every ${STAGGER_GAP_MS / 1000}s to avoid connection errors`}
                    onClick={() => reconnectStaggered(stoppedIds)}
                  >
                    <PlugZap />
                    Reconnect stopped ({stoppedIds.length})
                  </Button>
                )
              )}
              <Button onClick={() => setAddOpen(true)}>
                <Plus />
                Add bot
              </Button>
            </>
          }
        />

        {bots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Online" value={`${counts.online}/${bots.length}`} icon={Bot} tone="success" />
            <StatCard
              label={attention > 0 ? 'Needs attention' : 'Stopped'}
              value={attention > 0 ? attention : counts.stopped}
              icon={CircleAlert}
              tone={attention > 0 ? 'warning' : 'neutral'}
              sub={attention > 0 && counts.stopped > 0 ? `${counts.stopped} stopped` : undefined}
            />
            <StatCard label="Total gems" value={compact(totalGems)} icon={Gem} tone="info" />
            <StatCard
              label="Average ping"
              value={avgPing ? `${avgPing} ms` : '–'}
              icon={Wifi}
              tone="neutral"
            />
          </div>
        )}

        {bots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40">
            <EmptyState
              icon={Bot}
              title="No bots yet"
              description="Add a bot with a Google account, GrowID or login token. Saved logins come back after a restart and wait for you to press Reconnect."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus />
                  Add your first bot
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <BotFilterBar
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
              counts={counts}
              className="sm:max-w-xl"
            />
            {visible.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No bots match"
                description="Try a different search or clear the status filter."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((bot) => (
                  <BotCard key={bot.id} bot={bot} onOpen={() => setSelected(bot.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
