import { useState } from 'react'
import { Gem, MapPin, PlugZap, Trash2, Wifi } from 'lucide-react'
import type { LiveBot } from '@/lib/store'
import { statusMeta } from '@/lib/status'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { ConfirmDialog, StatusBadge, StatusDot, compact } from '@/components/common'
import { deleteBot, reconnectBot } from './bot-actions'

/** Whether a Reconnect button makes sense as a quick action for this bot. */
export function canQuickReconnect(bot: LiveBot) {
  return bot.status !== 'in_game'
}

export function RemoveBotConfirm({
  bot,
  open,
  onOpenChange,
}: {
  bot: LiveBot
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Remove ${bot.username}?`}
      confirmLabel="Remove bot"
      destructive
      description={
        <>
          The bot disconnects and is removed from the list. If it was saved (Google or Token login),
          its saved login is deleted too, so you would need to sign in again to bring it back.
        </>
      }
      onConfirm={async () => {
        await deleteBot(bot.id, bot.username)
      }}
    />
  )
}

// ── Compact row (side panel) ────────────────────────────────────────────────

export function BotRow({
  bot,
  selected,
  onSelect,
}: {
  bot: LiveBot
  selected: boolean
  onSelect: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const meta = statusMeta(bot.status)

  return (
    <>
      <div
        className={cn(
          'group relative flex items-center gap-2 rounded-lg transition-colors',
          selected ? 'bg-accent' : 'hover:bg-muted',
        )}
      >
        {selected && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r bg-primary" aria-hidden />}
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? 'true' : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatusDot status={bot.status} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-tight">{bot.username}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {bot.status === 'in_game' && bot.world_name ? bot.world_name : meta.label}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center pr-1.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {canQuickReconnect(bot) && (
            <Hint label="Reconnect">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Reconnect ${bot.username}`}
                onClick={() => reconnectBot(bot.id, bot.username)}
              >
                <PlugZap />
              </Button>
            </Hint>
          )}
          <Hint label="Remove bot">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${bot.username}`}
              className="hover:text-destructive"
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
            </Button>
          </Hint>
        </div>
      </div>
      <RemoveBotConfirm bot={bot} open={confirm} onOpenChange={setConfirm} />
    </>
  )
}

// ── Rich card (fleet overview) ──────────────────────────────────────────────

export function BotCard({ bot, onOpen }: { bot: LiveBot; onOpen: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const meta = statusMeta(bot.status)

  return (
    <>
      <article className="group flex animate-fade-up flex-col rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 flex-col gap-3 rounded-t-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{bot.username}</h3>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {bot.world_name && bot.status === 'in_game' ? bot.world_name : 'Not in a world'}
              </p>
            </div>
            <StatusBadge status={bot.status} />
          </div>

          <dl className="grid grid-cols-3 gap-2 text-xs">
            <Metric icon={Gem} label="Gems" value={bot.gems > 0 ? compact(bot.gems) : '–'} />
            <Metric icon={Wifi} label="Ping" value={bot.ping_ms > 0 ? `${bot.ping_ms} ms` : '–'} />
            <Metric
              label="Level"
              value={bot.track_info?.level != null && bot.track_info.level > 0 ? String(bot.track_info.level) : '–'}
            />
          </dl>

          {meta.tone !== 'success' && <p className="text-xs text-muted-foreground">{meta.hint}</p>}
        </button>

        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onOpen}>
            Open
          </Button>
          <div className="flex items-center gap-1">
            {canQuickReconnect(bot) && (
              <Button variant="secondary" size="sm" onClick={() => reconnectBot(bot.id, bot.username)}>
                <PlugZap />
                Reconnect
              </Button>
            )}
            <Hint label="Remove bot">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${bot.username}`}
                className="hover:text-destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 />
              </Button>
            </Hint>
          </div>
        </div>
      </article>
      <RemoveBotConfirm bot={bot} open={confirm} onOpenChange={setConfirm} />
    </>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </dt>
      <dd className="tabular mt-0.5 truncate font-medium text-foreground">{value}</dd>
    </div>
  )
}
