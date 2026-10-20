import { atom, getDefaultStore } from 'jotai'
import { api, type BotCmd } from '@/lib/api'
import { botsAtom, selectedBotIdAtom } from '@/lib/store'
import { toast } from '@/lib/toast'

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Sends a bot command and reports failure (and optionally success) as a toast. */
export async function runCmd(
  botId: number,
  cmd: BotCmd,
  opts: { success?: string; error?: string } = {},
): Promise<boolean> {
  try {
    await api.sendCmd(botId, cmd)
    if (opts.success) toast.success(opts.success)
    return true
  } catch (e) {
    toast.error(opts.error ?? 'Command failed', errMessage(e))
    return false
  }
}

export async function reconnectBot(botId: number, name?: string) {
  return runCmd(
    botId,
    { type: 'reconnect' },
    { success: name ? `Reconnecting ${name}…` : 'Reconnecting…', error: 'Could not reconnect' },
  )
}

export async function deleteBot(botId: number, name?: string): Promise<boolean> {
  const store = getDefaultStore()
  try {
    await api.deleteBot(botId)
    store.set(botsAtom, (m) => {
      const n = new Map(m)
      n.delete(botId)
      return n
    })
    store.set(selectedBotIdAtom, (id) => (id === botId ? null : id))
    toast.success(name ? `${name} removed` : 'Bot removed')
    return true
  } catch (e) {
    toast.error('Could not remove the bot', errMessage(e))
    return false
  }
}

// ── Staggered reconnect ─────────────────────────────────────────────────────
// Logging in many bots at the same moment from one IP often ends in
// "Error connecting", so bulk reconnects are spaced out.

export const STAGGER_GAP_MS = 8000

interface StaggerState {
  running: boolean
  done: number
  total: number
}

export const staggerAtom = atom<StaggerState>({ running: false, done: 0, total: 0 })
let cancelRequested = false

export function cancelStagger() {
  cancelRequested = true
}

export async function reconnectStaggered(ids: number[], gapMs = STAGGER_GAP_MS) {
  const store = getDefaultStore()
  if (store.get(staggerAtom).running || ids.length === 0) return
  cancelRequested = false
  store.set(staggerAtom, { running: true, done: 0, total: ids.length })

  let failed = 0
  for (let i = 0; i < ids.length; i++) {
    if (cancelRequested) break
    try {
      await api.sendCmd(ids[i], { type: 'reconnect' })
    } catch {
      failed++
    }
    store.set(staggerAtom, { running: true, done: i + 1, total: ids.length })
    if (i < ids.length - 1) {
      // sleep in small slices so Cancel feels immediate
      const until = Date.now() + gapMs
      while (Date.now() < until && !cancelRequested) {
        await new Promise((r) => setTimeout(r, 250))
      }
    }
  }

  const { done } = store.get(staggerAtom)
  store.set(staggerAtom, { running: false, done: 0, total: 0 })
  if (cancelRequested) {
    toast.info('Reconnect cancelled', `${done} of ${ids.length} bots were started.`)
  } else if (failed > 0) {
    toast.warning('Reconnect finished with errors', `${failed} of ${ids.length} commands failed.`)
  } else {
    toast.success('Reconnect started for all bots', `${ids.length} bot${ids.length === 1 ? '' : 's'}, spaced ${gapMs / 1000}s apart.`)
  }
}
