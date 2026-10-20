import { useState } from 'react'
import { atom, useAtom } from 'jotai'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Plus } from 'lucide-react'
import {
  api,
  type SpawnBotBody,
  type SpawnGoogleBody,
  type SpawnLtokenBody,
} from '@/lib/api'
import { selectedBotIdAtom } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSetAtom } from 'jotai'

export const addBotOpenAtom = atom(false)

type Method = 'google' | 'legacy' | 'ltoken'

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'google', label: 'Google', hint: 'Sign in with a Google account' },
  { id: 'legacy', label: 'GrowID', hint: 'Username and password' },
  { id: 'ltoken', label: 'Token', hint: 'token|rid|mac|wk' },
]

function errText(e: unknown, fallback: string) {
  const m = e instanceof Error ? e.message : ''
  return m ? `${fallback} (${m})` : fallback
}

export function AddBotDialog() {
  const [open, setOpen] = useAtom(addBotOpenAtom)
  const setSelected = useSetAtom(selectedBotIdAtom)

  const [method, setMethod] = useState<Method>('google')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [ltokenStr, setLtokenStr] = useState('')
  const [showProxy, setShowProxy] = useState(false)
  const [proxyStr, setProxyStr] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleLink, setGoogleLink] = useState<{ link: string; rid: string } | null>(null)
  const [googleToken, setGoogleToken] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  function reset() {
    setUsername('')
    setPassword('')
    setLtokenStr('')
    setProxyStr('')
    setShowProxy(false)
    setError('')
    setGoogleLink(null)
    setGoogleToken('')
  }

  function onOpenChange(o: boolean) {
    if (loading) return
    setOpen(o)
    if (!o) reset()
  }

  async function handleGetGoogleLink() {
    setError('')
    setLinkLoading(true)
    try {
      setGoogleLink(await api.googleLink())
    } catch (e) {
      setError(errText(e, 'Failed to get the Google link, please try again'))
    } finally {
      setLinkLoading(false)
    }
  }

  function buildProxy(body: SpawnBotBody | SpawnLtokenBody | SpawnGoogleBody): string | null {
    if (!showProxy || !proxyStr.trim()) return null
    const parts = proxyStr.trim().split(':')
    const port = parseInt(parts[1] ?? '', 10)
    if (parts.length < 2 || !parts[0] || !Number.isFinite(port)) {
      return 'Proxy must look like host:port or host:port:user:pass'
    }
    body.proxy_host = parts[0]
    body.proxy_port = port
    if (parts[2]) body.proxy_username = parts[2]
    if (parts[3]) body.proxy_password = parts[3]
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    let body: SpawnBotBody | SpawnLtokenBody | SpawnGoogleBody
    if (method === 'legacy') body = { username: username.trim(), password }
    else if (method === 'ltoken') body = { ltoken: ltokenStr.trim() }
    else {
      if (!googleLink) {
        setError('Get a Google link first (step 1)')
        return
      }
      body = { token: googleToken.trim(), rid: googleLink.rid }
    }

    const proxyErr = buildProxy(body)
    if (proxyErr) {
      setError(proxyErr)
      return
    }

    setLoading(true)
    try {
      let res: { id: number }
      if (method === 'legacy') res = await api.spawnBot(body as SpawnBotBody)
      else if (method === 'ltoken') res = await api.spawnLtokenBot(body as SpawnLtokenBody)
      else res = await api.spawnGoogleBot(body as SpawnGoogleBody)
      toast.success('Bot added', 'It is logging in now.')
      if (res && typeof res.id === 'number') setSelected(res.id)
      setOpen(false)
      reset()
    } catch (err) {
      setError(errText(err, 'Failed to add the bot. Check the details and try again'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add bot</DialogTitle>
          <DialogDescription>
            Choose how this bot signs in. Google and Token bots are saved so they can be
            restored after a restart.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={method === m.id}
                onClick={() => {
                  setMethod(m.id)
                  setError('')
                }}
                className={cn(
                  'h-8 rounded-md text-sm font-medium transition-colors',
                  method === m.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {method === 'google' && (
            <ol className="flex flex-col gap-3">
              <Step n={1} title="Get a sign-in link">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetGoogleLink}
                  disabled={linkLoading}
                >
                  {linkLoading && <Loader2 className="animate-spin" />}
                  {googleLink ? 'Get a new link' : 'Get Google link'}
                </Button>
              </Step>
              <Step n={2} title="Sign in with Google" muted={!googleLink}>
                {googleLink ? (
                  <a
                    href={googleLink.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Open sign-in page
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Available after step 1.</p>
                )}
              </Step>
              <Step n={3} title="Paste the token or JSON result" muted={!googleLink}>
                <Input
                  placeholder="Paste here"
                  value={googleToken}
                  onChange={(e) => setGoogleToken(e.target.value)}
                  className="font-mono"
                  disabled={!googleLink}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </Step>
            </ol>
          )}

          {method === 'legacy' && (
            <div className="flex flex-col gap-3">
              <Field label="GrowID">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Passwords are never saved; this bot will not be restored after a restart.
              </p>
            </div>
          )}

          {method === 'ltoken' && (
            <Field label="Login token">
              <Input
                placeholder="token|rid|mac|wk"
                value={ltokenStr}
                onChange={(e) => setLtokenStr(e.target.value)}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowProxy((v) => !v)}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={showProxy}
            >
              {showProxy ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Use a proxy (optional)
            </button>
            {showProxy && (
              <div className="mt-2">
                <Input
                  placeholder="host:port:user:pass"
                  value={proxyStr}
                  onChange={(e) => setProxyStr(e.target.value)}
                  className="font-mono"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  SOCKS5 with UDP support. Use the Proxy page to test it first.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Plus />}
              Add bot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function Step({
  n,
  title,
  muted,
  children,
}: {
  n: number
  title: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <li className={cn('flex gap-3', muted && 'opacity-60')}>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  )
}
