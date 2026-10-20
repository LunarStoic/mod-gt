import { useEffect, useState } from 'react'
import { useSetAtom } from 'jotai'
import {
  Backpack,
  ChevronLeft,
  Code2,
  Gauge,
  Gem,
  Globe,
  LayoutDashboard,
  MapPin,
  PlugZap,
  RefreshCw,
  Settings2,
  TerminalSquare,
  Trash2,
  Unplug,
  Wifi,
} from 'lucide-react'
import { botsAtom, selectedBotIdAtom, type LiveBot } from '@/lib/store'
import { api } from '@/lib/api'
import { statusMeta } from '@/lib/status'
import { toast } from '@/lib/toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { StatusBadge, compact } from '@/components/common'
import { reconnectBot, runCmd } from './bot-actions'
import { RemoveBotConfirm } from './bot-items'
import { OverviewTab } from './tabs/overview-tab'
import { WorldTab } from './tabs/world-tab'
import { InventoryTab } from './tabs/inventory-tab'
import { ConsoleTab } from './tabs/console-tab'
import { ScriptTab } from './tabs/script-tab'
import { SettingsTab } from './tabs/settings-tab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'inventory', label: 'Inventory', icon: Backpack },
  { id: 'console', label: 'Console', icon: TerminalSquare },
  { id: 'script', label: 'Script', icon: Code2 },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const

type TabId = (typeof TABS)[number]['id']

function loadTab(): TabId {
  try {
    const v = sessionStorage.getItem('mori_bot_tab')
    if (TABS.some((t) => t.id === v)) return v as TabId
  } catch {
    // ignore
  }
  return 'overview'
}

export function BotDetail({ bot }: { bot: LiveBot }) {
  const setSelectedId = useSetAtom(selectedBotIdAtom)
  const setBots = useSetAtom(botsAtom)
  const [tab, setTab] = useState<TabId>(loadTab)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem('mori_bot_tab', tab)
    } catch {
      // ignore
    }
  }, [tab])

  // Seed the full state from REST when a bot is opened.
  useEffect(() => {
    let cancelled = false
    api
      .getBotState(bot.id)
      .then((s) => {
        if (cancelled) return
        setBots((m) => {
          const existing = m.get(bot.id)
          if (!existing) return m
          return new Map(m).set(bot.id, {
            ...existing,
            status: s.status,
            world_name: s.world_name,
            pos_x: s.pos_x,
            pos_y: s.pos_y,
            world_width: s.world_width,
            world_height: s.world_height,
            tiles: s.tiles.map((t) => ({
              fg: t.fg_item_id,
              bg: t.bg_item_id,
              flags: t.flags,
              tile_type: t.tile_type,
            })),
            players: new Map(s.players.map((p) => [p.net_id, p])),
            objects: s.objects,
            inventory: s.inventory,
            inventory_slots: s.inventory_slots,
            gems: s.gems,
            console: s.console,
            ping_ms: s.ping_ms,
            delays: s.delays,
            track_info: s.track_info,
            auto_collect: s.auto_collect,
            collect_radius_tiles: s.collect_radius_tiles,
            collect_blacklist: s.collect_blacklist,
            auto_reconnect: s.auto_reconnect,
          })
        })
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load bot details', 'Live updates will still arrive.')
      })
    return () => {
      cancelled = true
    }
  }, [bot.id, setBots])

  async function toggleAutoReconnect(enabled: boolean) {
    const apply = (v: boolean) =>
      setBots((m) => {
        const b = m.get(bot.id)
        return b ? new Map(m).set(bot.id, { ...b, auto_reconnect: v }) : m
      })
    apply(enabled)
    const ok = await runCmd(
      bot.id,
      { type: 'set_auto_reconnect', enabled },
      {
        success: `Auto-reconnect ${enabled ? 'on' : 'off'}`,
        error: 'Could not change auto-reconnect',
      },
    )
    if (!ok) apply(!enabled)
  }

  const meta = statusMeta(bot.status)
  const inGame = bot.status === 'in_game'
  const level = bot.track_info?.level ?? 0
  // Offer Reconnect as the primary action whenever the bot is not online.
  const reconnectPrimary = !inGame

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/60">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-6">
          <Hint label="Back to all bots">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Back to all bots"
              onClick={() => setSelectedId(null)}
            >
              <ChevronLeft />
            </Button>
          </Hint>

          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-tight">{bot.username}</h1>
              <StatusBadge status={bot.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {inGame && bot.world_name ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {bot.world_name}
                  <span className="tabular text-muted-foreground/70">
                    ({Math.round(bot.pos_x)}, {Math.round(bot.pos_y)})
                  </span>
                </span>
              ) : (
                <span>{meta.hint}</span>
              )}
              {bot.gems > 0 && (
                <span className="tabular flex items-center gap-1.5 text-success">
                  <Gem className="size-3.5" />
                  {compact(bot.gems)}
                </span>
              )}
              {bot.ping_ms > 0 && (
                <span className="tabular flex items-center gap-1.5">
                  <Wifi className="size-3.5" />
                  {bot.ping_ms} ms
                </span>
              )}
              {level > 0 && (
                <span className="tabular flex items-center gap-1.5">
                  <Gauge className="size-3.5" />
                  Level {level}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Hint label="Reconnect automatically when the connection drops">
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 text-sm">
                <RefreshCw className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Auto</span>
                <Switch
                  size="sm"
                  checked={bot.auto_reconnect}
                  onCheckedChange={toggleAutoReconnect}
                  aria-label="Auto-reconnect"
                />
              </label>
            </Hint>
            <Button
              variant={reconnectPrimary ? 'default' : 'outline'}
              onClick={() => reconnectBot(bot.id, bot.username)}
            >
              <PlugZap />
              Reconnect
            </Button>
            <Hint
              label={
                bot.auto_reconnect
                  ? 'Turn off auto-reconnect to disconnect manually'
                  : 'Disconnect this bot'
              }
            >
              {/* span keeps the tooltip working while the button is disabled */}
              <span tabIndex={bot.auto_reconnect ? 0 : -1}>
                <Button
                  variant="outline"
                  disabled={bot.auto_reconnect}
                  onClick={() =>
                    runCmd(bot.id, { type: 'disconnect' }, { success: 'Disconnected', error: 'Could not disconnect' })
                  }
                >
                  <Unplug />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </span>
            </Hint>
            <Hint label="Remove bot">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove bot"
                className="hover:text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 />
              </Button>
            </Hint>
          </div>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="scrollbar-none shrink-0 overflow-x-auto border-b border-border">
          <TabsList variant="line" className="h-11 w-max min-w-full justify-start gap-1 rounded-none px-2 sm:px-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-full flex-none rounded-none px-3 text-sm after:!bottom-0 after:!h-0.5 after:bg-primary data-active:text-foreground"
              >
                <Icon />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="min-h-0 overflow-y-auto">
          <OverviewTab bot={bot} />
        </TabsContent>
        <TabsContent value="world" className="min-h-0 overflow-y-auto">
          <WorldTab bot={bot} />
        </TabsContent>
        <TabsContent value="inventory" className="min-h-0 overflow-y-auto">
          <InventoryTab bot={bot} />
        </TabsContent>
        <TabsContent value="console" className="min-h-0">
          <ConsoleTab lines={bot.console} />
        </TabsContent>
        <TabsContent value="script" className="min-h-0">
          <ScriptTab bot={bot} />
        </TabsContent>
        <TabsContent value="settings" className="min-h-0 overflow-y-auto">
          <SettingsTab bot={bot} />
        </TabsContent>
      </Tabs>

      <RemoveBotConfirm bot={bot} open={confirmRemove} onOpenChange={setConfirmRemove} />
    </div>
  )
}
