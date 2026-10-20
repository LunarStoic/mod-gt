import { useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Backpack,
  Compass,
  Globe,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { LiveBot } from '@/lib/store'
import { Minimap } from '@/components/minimap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hint } from '@/components/ui/tooltip'
import { Card, KeyValue, StatCard, compact } from '@/components/common'
import { runCmd } from '../bot-actions'

export function OverviewTab({ bot }: { bot: LiveBot }) {
  const info = bot.track_info
  const inWorld = bot.status === 'in_game' && !!bot.world_name

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="World" value={inWorld ? bot.world_name : '–'} icon={Globe} tone="info" />
        <StatCard
          label="Position"
          value={inWorld ? `${Math.round(bot.pos_x)}, ${Math.round(bot.pos_y)}` : '–'}
          icon={MapPin}
          sub={inWorld ? 'tile x, y' : undefined}
        />
        <StatCard label="Players here" value={inWorld ? bot.players.size : '–'} icon={Users} />
        <StatCard
          label="Backpack"
          value={bot.inventory_slots > 0 ? `${bot.inventory.length}/${bot.inventory_slots}` : '–'}
          icon={Backpack}
          sub={bot.gems > 0 ? `${compact(bot.gems)} gems` : undefined}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Minimap" hint="click to walk · scroll to zoom">
          <Minimap bot={bot} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Movement">
            <div className="flex flex-col gap-4">
              <WarpInput botId={bot.id} />
              <DPad botId={bot.id} />
            </div>
          </Card>

          <Card title="Account">
            <dl className="divide-y divide-border">
              <KeyValue label="Level">{info && info.level > 0 ? info.level : '–'}</KeyValue>
              <KeyValue label="Grow ID">{info && info.grow_id > 0 ? info.grow_id : '–'}</KeyValue>
              <KeyValue label="Awesomeness">{info ? info.awesomeness : '–'}</KeyValue>
              <KeyValue label="Playtime">
                {info && info.global_playtime > 0
                  ? `${Math.floor(info.global_playtime / 3600).toLocaleString()} h`
                  : '–'}
              </KeyValue>
              <KeyValue label="Install date">
                {info && info.install_date > 0
                  ? new Date(info.install_date * 1000).toLocaleDateString()
                  : '–'}
              </KeyValue>
            </dl>
            <Hint label="Accept the pending world access / invitation prompt">
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() =>
                  runCmd(bot.id, { type: 'accept_access' }, { success: 'Access accepted', error: 'Could not accept access' })
                }
              >
                <ShieldCheck />
                Accept access
              </Button>
            </Hint>
          </Card>
        </div>
      </div>
    </div>
  )
}

function WarpInput({ botId }: { botId: number }) {
  const [worldName, setWorldName] = useState('')
  const [doorId, setDoorId] = useState('')
  const [busy, setBusy] = useState(false)

  async function doWarp(e?: React.FormEvent) {
    e?.preventDefault()
    const name = worldName.trim().toUpperCase()
    if (!name) return
    setBusy(true)
    const ok = await runCmd(
      botId,
      { type: 'warp', name, id: doorId.trim() },
      { success: `Warping to ${name}…`, error: 'Could not warp' },
    )
    setBusy(false)
    if (ok) setWorldName('')
  }

  return (
    <form onSubmit={doWarp} className="flex flex-col gap-1.5">
      <label htmlFor="warp-world" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Compass className="size-3.5" />
        Warp to world
      </label>
      <div className="flex gap-2">
        <Input
          id="warp-world"
          className="uppercase"
          placeholder="World name"
          value={worldName}
          onChange={(e) => setWorldName(e.target.value)}
          autoComplete="off"
        />
        <Input
          className="w-20"
          placeholder="Door"
          aria-label="Door ID (optional)"
          value={doorId}
          onChange={(e) => setDoorId(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" disabled={!worldName.trim() || busy}>
          Warp
        </Button>
      </div>
    </form>
  )
}

function DPad({ botId }: { botId: number }) {
  const move = (x: number, y: number) => runCmd(botId, { type: 'move', x, y }, { error: 'Could not move' })

  const key = 'flex size-11 items-center justify-center rounded-lg border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent active:translate-y-px'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="self-start text-xs font-medium text-muted-foreground">Move one tile</p>
      <div className="grid grid-cols-3 gap-1.5">
        <div />
        <button type="button" aria-label="Move up" className={key} onClick={() => move(0, -1)}>
          <ArrowUp className="size-4" />
        </button>
        <div />
        <button type="button" aria-label="Move left" className={key} onClick={() => move(-1, 0)}>
          <ArrowLeft className="size-4" />
        </button>
        <button type="button" aria-label="Move down" className={key} onClick={() => move(0, 1)}>
          <ArrowDown className="size-4" />
        </button>
        <button type="button" aria-label="Move right" className={key} onClick={() => move(1, 0)}>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
