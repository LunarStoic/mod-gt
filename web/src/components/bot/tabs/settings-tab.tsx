import { useState } from 'react'
import { useSetAtom } from 'jotai'
import { Loader2, Plus, Save, X } from 'lucide-react'
import { botsAtom, type LiveBot } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/common'
import { runCmd } from '../bot-actions'
import { useItemLabel } from '../use-item-label'

type Delays = LiveBot['delays']

function patchBot(botId: number, patch: Partial<LiveBot>) {
  return (m: Map<number, LiveBot>) => {
    const b = m.get(botId)
    return b ? new Map(m).set(botId, { ...b, ...patch }) : m
  }
}

export function SettingsTab({ bot }: { bot: LiveBot }) {
  const setBots = useSetAtom(botsAtom)

  async function toggle(
    key: 'auto_collect' | 'auto_reconnect',
    cmdType: 'set_auto_collect' | 'set_auto_reconnect',
    enabled: boolean,
    label: string,
  ) {
    setBots(patchBot(bot.id, { [key]: enabled }))
    const ok = await runCmd(
      bot.id,
      { type: cmdType, enabled },
      { success: `${label} ${enabled ? 'on' : 'off'}`, error: `Could not change ${label.toLowerCase()}` },
    )
    if (!ok) setBots(patchBot(bot.id, { [key]: !enabled }))
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card title="Behaviour">
          <div className="flex flex-col divide-y divide-border">
            <SwitchRow
              title="Auto-reconnect"
              description="Log back in automatically when the connection drops. Turn it off to use Disconnect and Reconnect manually."
              checked={bot.auto_reconnect}
              onChange={(v) => toggle('auto_reconnect', 'set_auto_reconnect', v, 'Auto-reconnect')}
            />
            <SwitchRow
              title="Auto-collect"
              description="Pick up dropped items near the bot automatically."
              checked={bot.auto_collect}
              onChange={(v) => toggle('auto_collect', 'set_auto_collect', v, 'Auto-collect')}
            />
          </div>
        </Card>

        <CollectRange bot={bot} />
        <Blacklist bot={bot} />
      </div>

      <div className="flex flex-col gap-4">
        <DelaysCard key={Object.values(bot.delays).join('-')} bot={bot} />
      </div>
    </div>
  )
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = `sw-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  )
}

// ── Auto-collect range ──────────────────────────────────────────────────────

/** 9×9 grid so Chebyshev distance from the centre runs 0..4, giving a clickable radius of 1..5. */
const GRID = 9
const MID = (GRID - 1) / 2

const cheb = (row: number, col: number) => Math.max(Math.abs(row - MID), Math.abs(col - MID))
const radiusOf = (row: number, col: number) => Math.min(5, Math.max(1, cheb(row, col) + 1))

async function sendCollectConfig(botId: number, radius: number, blacklist: number[]) {
  return runCmd(
    botId,
    { type: 'set_collect_config', radius_tiles: radius, blacklist },
    { error: 'Could not save the collect settings' },
  )
}

function CollectRange({ bot }: { bot: LiveBot }) {
  const setBots = useSetAtom(botsAtom)
  const radius = bot.collect_radius_tiles

  async function setRadius(next: number) {
    if (next === radius) return
    const prev = radius
    setBots(patchBot(bot.id, { collect_radius_tiles: next }))
    const ok = await sendCollectConfig(bot.id, next, bot.collect_blacklist)
    if (!ok) setBots(patchBot(bot.id, { collect_radius_tiles: prev }))
  }

  return (
    <Card title="Auto-collect range" hint="click a square to set the radius">
      <div className="flex flex-col items-center gap-3">
        <div
          className="grid w-fit gap-1 rounded-xl border border-border bg-muted/30 p-2"
          style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: GRID * GRID }, (_, i) => {
            const row = Math.floor(i / GRID)
            const col = i % GRID
            const inRange = cheb(row, col) < radius
            const center = row === MID && col === MID
            return (
              <button
                key={i}
                type="button"
                title={`Radius ${radiusOf(row, col)}`}
                aria-label={`Set radius ${radiusOf(row, col)}`}
                onClick={() => setRadius(radiusOf(row, col))}
                className={cn(
                  'flex size-6 items-center justify-center rounded-sm border text-[9px] transition-colors sm:size-7',
                  inRange
                    ? 'border-primary/50 bg-primary/35'
                    : 'border-border bg-background/80 hover:bg-muted',
                  center && 'ring-1 ring-primary ring-inset',
                )}
              >
                {center ? '●' : ''}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Radius{' '}
          <span className="tabular font-semibold text-foreground">{radius}</span> tile
          {radius === 1 ? '' : 's'}
        </p>
      </div>
    </Card>
  )
}

function Blacklist({ bot }: { bot: LiveBot }) {
  const itemLabel = useItemLabel()
  const setBots = useSetAtom(botsAtom)
  const [input, setInput] = useState('')
  const list = [...bot.collect_blacklist].sort((a, b) => a - b)

  async function apply(next: number[]) {
    const prev = bot.collect_blacklist
    setBots(patchBot(bot.id, { collect_blacklist: next }))
    const ok = await sendCollectConfig(bot.id, bot.collect_radius_tiles, next)
    if (!ok) setBots(patchBot(bot.id, { collect_blacklist: prev }))
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const id = parseInt(input.trim(), 10)
    if (!Number.isFinite(id) || id < 0 || id > 65535) {
      toast.warning('Enter a valid item ID', 'Item IDs are numbers from 0 to 65535.')
      return
    }
    if (list.includes(id)) {
      toast.info('Already on the list')
      return
    }
    setInput('')
    void apply([...list, id])
  }

  return (
    <Card title="Never auto-collect" hint="item IDs">
      <form onSubmit={add} className="flex gap-2">
        <Input
          type="number"
          min={0}
          max={65535}
          placeholder="Item ID"
          aria-label="Item ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
        />
        <Button type="submit" variant="secondary" disabled={!input.trim()}>
          <Plus />
          Add
        </Button>
      </form>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {list.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            No items excluded. Everything nearby gets collected.
          </li>
        ) : (
          list.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="truncate">{itemLabel(id)}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${itemLabel(id)}`}
                onClick={() => apply(list.filter((x) => x !== id))}
              >
                <X />
              </Button>
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}

// ── Delays ──────────────────────────────────────────────────────────────────

const ACTION_FIELDS: { key: keyof Delays; label: string; hint: string; min: number; step: number; unit: string }[] = [
  { key: 'place_ms', label: 'Place / punch', hint: 'Wait after each block action', min: 0, step: 50, unit: 'ms' },
  { key: 'walk_ms', label: 'Walk / pathfind', hint: 'Wait per tile while walking', min: 0, step: 50, unit: 'ms' },
]

const RETRY_FIELDS: { key: keyof Delays; label: string; hint: string; min: number; step: number; unit: string }[] = [
  { key: 'twofa_secs', label: 'Account protection (2FA)', hint: 'Retry wait when approval is pending', min: 1, step: 1, unit: 's' },
  { key: 'server_overload_secs', label: 'Server overloaded', hint: 'Retry wait when the server is busy', min: 1, step: 1, unit: 's' },
  { key: 'too_many_logins_secs', label: 'Too many logins', hint: 'Retry wait after being rate limited', min: 1, step: 1, unit: 's' },
  { key: 'maintenance_secs', label: 'Maintenance', hint: 'Retry wait during maintenance', min: 1, step: 1, unit: 's' },
]

function toForm(d: Delays): Record<keyof Delays, string> {
  return {
    place_ms: String(d.place_ms),
    walk_ms: String(d.walk_ms),
    twofa_secs: String(d.twofa_secs),
    server_overload_secs: String(d.server_overload_secs),
    too_many_logins_secs: String(d.too_many_logins_secs),
    maintenance_secs: String(d.maintenance_secs),
  }
}

function DelaysCard({ bot }: { bot: LiveBot }) {
  const setBots = useSetAtom(botsAtom)
  const [form, setForm] = useState(() => toForm(bot.delays))
  const [saving, setSaving] = useState(false)

  const d = bot.delays

  const parsed = (Object.keys(form) as (keyof Delays)[]).reduce(
    (acc, k) => ({ ...acc, [k]: parseInt(form[k], 10) }),
    {} as Delays,
  )
  const allFields = [...ACTION_FIELDS, ...RETRY_FIELDS]
  const invalid = allFields.some((f) => !Number.isFinite(parsed[f.key]) || parsed[f.key] < f.min)
  const dirty = allFields.some((f) => parsed[f.key] !== d[f.key])

  async function save() {
    setSaving(true)
    const ok = await runCmd(
      bot.id,
      { type: 'set_delays', ...parsed },
      { success: 'Delays saved', error: 'Could not save the delays' },
    )
    if (ok) setBots(patchBot(bot.id, { delays: parsed }))
    setSaving(false)
  }

  function renderField(f: (typeof ACTION_FIELDS)[number]) {
    const bad = !Number.isFinite(parsed[f.key]) || parsed[f.key] < f.min
    return (
      <label key={f.key} className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{f.label}</span>
        <div className="relative">
          <Input
            type="number"
            min={f.min}
            step={f.step}
            value={form[f.key]}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            aria-invalid={bad}
            className="tabular pr-10"
            inputMode="numeric"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {f.unit}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{f.hint}</span>
      </label>
    )
  }

  return (
    <Card
      title="Timing"
      actions={
        <Button size="sm" onClick={save} disabled={saving || invalid || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Action delays</h3>
          <div className="grid gap-4 sm:grid-cols-2">{ACTION_FIELDS.map(renderField)}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            Lower values are faster but make the server more likely to disconnect the bot.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Retry delays</h3>
          <div className="grid gap-4 sm:grid-cols-2">{RETRY_FIELDS.map(renderField)}</div>
        </div>
      </div>
    </Card>
  )
}
