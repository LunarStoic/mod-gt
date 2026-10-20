import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Copy, Eraser, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, type CheckResult, type ProxyTestResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { Card, EmptyState, PageHeader } from '@/components/common'

interface ParsedProxy {
  host: string
  port: number
  username?: string
  password?: string
}

function parseProxyLine(line: string): ParsedProxy | null {
  const parts = line.trim().split(':')
  if (parts.length < 2) return null
  const [host, rawPort, username, password] = parts
  const port = Number(rawPort)
  if (!host || !port) return null
  return { host, port, username: username || undefined, password: password || undefined }
}

type EntryStatus = 'idle' | 'testing' | 'done'

interface ProxyEntry {
  raw: string
  status: EntryStatus
  result?: ProxyTestResult
  parseError?: string
}

const isOk = (e: ProxyEntry) =>
  !!(e.result?.socks5.ok && e.result?.server_data.ok && e.result?.enet.ok)

export function ProxyPage() {
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<ProxyEntry[]>([])
  const [running, setRunning] = useState(false)

  function updateEntry(i: number, patch: Partial<ProxyEntry>) {
    setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  }

  async function handleTest() {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) return

    setEntries(lines.map((raw) => ({ raw, status: 'idle' })))
    setRunning(true)

    await Promise.allSettled(
      lines.map(async (raw, i) => {
        const parsed = parseProxyLine(raw)
        if (!parsed) {
          updateEntry(i, { status: 'done', parseError: 'Invalid format, use host:port[:user:pass]' })
          return
        }
        updateEntry(i, { status: 'testing' })
        try {
          const result = await api.testProxy({
            proxy_host: parsed.host,
            proxy_port: parsed.port,
            proxy_username: parsed.username,
            proxy_password: parsed.password,
          })
          updateEntry(i, { status: 'done', result })
        } catch (err) {
          updateEntry(i, {
            status: 'done',
            parseError: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )

    setRunning(false)
  }

  async function copyWorking() {
    const working = entries.filter(isOk).map((e) => e.raw)
    if (working.length === 0) return
    try {
      await navigator.clipboard.writeText(working.join('\n'))
      toast.success('Copied working proxies', `${working.length} proxy line${working.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not copy', 'Clipboard access was blocked by the browser.')
    }
  }

  const total = entries.length
  const done = entries.filter((e) => e.status === 'done').length
  const ok = entries.filter(isOk).length
  const lineCount = input.split('\n').filter((l) => l.trim()).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <PageHeader
          icon={ShieldCheck}
          title="Proxy tester"
          description="Check that SOCKS5 proxies can log in and play. Bots need SOCKS5 with UDP support."
          actions={
            total > 0 && (
              <div className="tabular flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {done}/{total} tested
                </span>
                <span className="text-success">{ok} working</span>
                <span className="text-destructive">{done - ok} failed</span>
              </div>
            )
          }
        />

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card title="Proxies" hint="one per line">
            <div className="flex flex-col gap-3">
              <Textarea
                className="min-h-48 resize-y font-mono text-xs"
                placeholder={'103.160.95.181:1080:user:pass\n45.32.10.5:1080'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                aria-label="Proxy list"
              />
              <p className="font-mono text-xs text-muted-foreground">host:port:user:pass</p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={lineCount === 0 || running} onClick={handleTest}>
                  {running ? <Loader2 className="animate-spin" /> : <Play />}
                  {running
                    ? 'Testing…'
                    : lineCount > 0
                      ? `Test ${lineCount} prox${lineCount === 1 ? 'y' : 'ies'}`
                      : 'Test proxies'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Clear"
                  title="Clear list and results"
                  disabled={running || (!input && total === 0)}
                  onClick={() => {
                    setInput('')
                    setEntries([])
                  }}
                >
                  <Eraser />
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Results"
            actions={
              ok > 0 && (
                <Button variant="outline" size="sm" onClick={copyWorking}>
                  <Copy />
                  Copy working
                </Button>
              )
            }
            bodyClassName="p-0"
          >
            {entries.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No results yet"
                description="Paste your proxies and press Test. Each one is checked for SOCKS5, server data and the ENet game connection."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="h-9 px-4 text-left font-medium">Proxy</th>
                      <th className="h-9 px-3 text-center font-medium whitespace-nowrap">SOCKS5</th>
                      <th className="h-9 px-3 text-center font-medium whitespace-nowrap">Server data</th>
                      <th className="h-9 px-3 text-center font-medium whitespace-nowrap">ENet UDP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => (
                      <ProxyRow key={i} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function CheckIcon({ check, testing }: { check?: CheckResult; testing: boolean }) {
  if (testing) return <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
  if (!check) return <span className="mx-auto block size-2 rounded-full bg-muted-foreground/30" />
  const detail = check.error || check.detail
  return check.ok ? (
    <CheckCircle2 className="mx-auto size-4 text-success" aria-label="Passed">
      {detail && <title>{detail}</title>}
    </CheckCircle2>
  ) : (
    <XCircle className="mx-auto size-4 text-destructive" aria-label="Failed">
      {detail && <title>{detail}</title>}
    </XCircle>
  )
}

function ProxyRow({ entry }: { entry: ProxyEntry }) {
  const testing = entry.status === 'testing'
  // never show the password back on screen
  const display = entry.raw.split(':').slice(0, 2).join(':')
  const allOk = isOk(entry)
  const firstError =
    entry.parseError ||
    (entry.result &&
      (!entry.result.socks5.ok
        ? entry.result.socks5.error
        : !entry.result.server_data.ok
          ? entry.result.server_data.error
          : !entry.result.enet.ok
            ? entry.result.enet.error
            : undefined))

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/40">
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'font-mono',
            entry.status === 'done' && allOk && 'text-success',
            entry.status !== 'done' && 'text-muted-foreground',
          )}
        >
          {display}
        </span>
        {entry.status === 'idle' && <span className="ml-2 text-xs text-muted-foreground">waiting…</span>}
        {firstError && <p className="mt-0.5 text-xs text-destructive/90">{firstError}</p>}
        {entry.result?.server_data.detail && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">→ {entry.result.server_data.detail}</p>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <CheckIcon check={entry.result?.socks5} testing={testing} />
      </td>
      <td className="px-3 py-2.5 text-center">
        <CheckIcon check={entry.result?.server_data} testing={testing} />
      </td>
      <td className="px-3 py-2.5 text-center">
        <CheckIcon check={entry.result?.enet} testing={testing} />
      </td>
    </tr>
  )
}
