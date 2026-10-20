import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileUp, Play, Square } from 'lucide-react'
import type { LiveBot } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { runCmd } from '../bot-actions'

type RunState = 'running' | 'finished' | 'stopped' | 'error' | 'unknown'

/** Works out the script state from the lifecycle lines the backend prints to the console. */
function scriptState(console_: string[]): RunState {
  for (let i = console_.length - 1; i >= 0; i--) {
    const t = console_[i].replace(/`./g, '')
    if (t.startsWith('[Script] started')) return 'running'
    if (t.startsWith('[Script] finished')) return 'finished'
    if (t.startsWith('[Script] stopped')) return 'stopped'
    if (t.startsWith('[Lua')) return 'error'
  }
  return 'unknown'
}

const STATE_META: Record<Exclude<RunState, 'unknown'>, { label: string; cls: string }> = {
  running: { label: 'Running', cls: 'border-success/25 bg-success/12 text-success' },
  finished: { label: 'Finished', cls: 'border-border bg-muted text-muted-foreground' },
  stopped: { label: 'Stopped', cls: 'border-border bg-muted text-muted-foreground' },
  error: { label: 'Stopped with error', cls: 'border-destructive/25 bg-destructive/12 text-destructive' },
}

const storageKey = (id: number) => `bot_script_${id}`

function loadDraft(id: number): string {
  try {
    return localStorage.getItem(storageKey(id)) ?? ''
  } catch {
    return ''
  }
}

export function ScriptTab({ bot }: { bot: LiveBot }) {
  const [script, setScript] = useState(() => loadDraft(bot.id))
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Keep the draft so switching tabs or reloading never loses work.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey(bot.id), script)
      } catch {
        // storage unavailable
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [bot.id, script])

  const state = useMemo(() => scriptState(bot.console), [bot.console])
  const running = state === 'running'
  const lines = script ? script.split('\n').length : 0

  async function run() {
    if (!script.trim()) {
      toast.warning('Nothing to run', 'Write or load a script first.')
      return
    }
    setBusy(true)
    await runCmd(bot.id, { type: 'run_script', content: script }, { success: 'Script started', error: 'Could not start the script' })
    setBusy(false)
  }

  async function stop() {
    setBusy(true)
    await runCmd(bot.id, { type: 'stop_script' }, { success: 'Stop requested', error: 'Could not stop the script' })
    setBusy(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void run()
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 1_000_000) {
      toast.error('File too large', 'Scripts larger than 1 MB are not supported.')
      return
    }
    try {
      setScript(await file.text())
      toast.success(`Loaded ${file.name}`)
    } catch {
      toast.error('Could not read the file')
    }
  }

  function download() {
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bot.username || 'bot'}-script.lua`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button onClick={run} disabled={busy}>
          <Play />
          Run
        </Button>
        <Button variant="destructive" onClick={stop} disabled={busy || (state !== 'running' && state !== 'unknown')}>
          <Square />
          Stop
        </Button>
        {state !== 'unknown' && (
          <span
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
              STATE_META[state].cls,
            )}
            role="status"
          >
            {running && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
            {STATE_META[state].label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".lua,.txt,text/plain"
            className="hidden"
            onChange={onFile}
          />
          <Hint label="Load a .lua or .txt file into the editor">
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp />
              <span className="hidden sm:inline">Load file</span>
            </Button>
          </Hint>
          <Hint label="Download the script">
            <Button variant="ghost" size="sm" onClick={download} disabled={!script}>
              <Download />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Hint>
        </div>
      </div>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Lua script"
        className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-background p-4 font-mono text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-3 focus:ring-ring/30"
        placeholder={'-- Lua script\nbot:warp("START")\nsleep(500)'}
      />

      <p className="shrink-0 text-xs text-muted-foreground">
        <span className="tabular">{lines.toLocaleString()}</span> lines · drafts are kept in this
        browser · <kbd className="rounded border border-border bg-muted px-1 font-sans">Ctrl</kbd>
        {' + '}
        <kbd className="rounded border border-border bg-muted px-1 font-sans">Enter</kbd> to run ·
        script output appears in the Console tab
      </p>
    </div>
  )
}
