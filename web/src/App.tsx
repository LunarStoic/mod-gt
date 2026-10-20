import { useState, useEffect, useCallback, type ComponentType } from 'react'
import { useAtomValue } from 'jotai'
import {
  Bot,
  Package,
  BookOpen,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Loader2,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BotsPage } from '@/pages/BotsPage'
import { ItemsPage } from '@/pages/ItemsPage'
import { DocsPage } from '@/pages/DocsPage'
import { ProxyPage } from '@/pages/ProxyPage'
import { SetupPage } from '@/pages/SetupPage'
import { LoginPage } from '@/pages/LoginPage'
import { authStore } from '@/lib/auth'
import { api } from '@/lib/api'
import { botsAtom, useMoriStore } from '@/lib/store'
import { moriWs } from '@/lib/ws'
import { useWsState } from '@/lib/use-ws-state'
import { useTheme } from '@/lib/theme'
import { Toaster, toast } from '@/lib/toast'
import { TooltipProvider, Hint } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

type Page = 'bots' | 'items' | 'proxy' | 'docs'
type AuthState = 'loading' | 'setup' | 'login' | 'authenticated'

interface NavItem {
  id: Page
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'proxy', label: 'Proxy', icon: ShieldCheck },
  { id: 'docs', label: 'Docs', icon: BookOpen },
]

const PAGE_TITLE: Record<Page, string> = {
  bots: 'Bots',
  items: 'Items',
  proxy: 'Proxy tester',
  docs: 'Lua docs',
}

function pageFromHash(): Page {
  const h = window.location.hash.replace(/^#\/?/, '')
  return (NAV.find((n) => n.id === h)?.id ?? 'bots') as Page
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')

  // On mount: determine auth state
  useEffect(() => {
    api
      .authStatus()
      .then(({ registered }) => {
        if (!registered) {
          setAuthState('setup')
        } else if (authStore.isLoggedIn()) {
          setAuthState('authenticated')
        } else {
          setAuthState('login')
        }
      })
      .catch(() => {
        // If we can't reach the server, still show login
        setAuthState('login')
      })

    // Listen for 401s from the API client
    const onUnauthorized = () => {
      moriWs.disconnect()
      setAuthState('login')
    }
    window.addEventListener('mori:unauthorized', onUnauthorized)
    return () => window.removeEventListener('mori:unauthorized', onUnauthorized)
  }, [])

  const handleLogout = useCallback(async () => {
    await api.authLogout().catch(() => {})
    authStore.clearToken()
    moriWs.disconnect()
    setAuthState('login')
  }, [])

  let content: React.ReactNode
  if (authState === 'loading') {
    content = <BootScreen />
  } else if (authState === 'setup') {
    content = <SetupPage onDone={() => setAuthState('authenticated')} />
  } else if (authState === 'login') {
    content = <LoginPage onDone={() => setAuthState('authenticated')} />
  } else {
    content = <Shell onLogout={handleLogout} />
  }

  return (
    <TooltipProvider>
      {content}
      <Toaster />
    </TooltipProvider>
  )
}

function BootScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LogoMark />
        <Skeleton className="h-2 w-28" />
      </div>
    </div>
  )
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm',
        className,
      )}
    >
      M
    </span>
  )
}

// ── Authenticated shell ─────────────────────────────────────────────────────

function Shell({ onLogout }: { onLogout: () => void }) {
  // Live data lives at the shell level so it keeps updating on every page.
  useMoriStore()

  const [page, setPageState] = useState<Page>(pageFromHash)
  const bots = useAtomValue(botsAtom)
  const wsState = useWsState()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const onHash = () => setPageState(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const setPage = useCallback((p: Page) => {
    window.location.hash = `/${p}`
    setPageState(p)
  }, [])

  // Tell the user when the live connection drops and when it comes back.
  const [wasOpen, setWasOpen] = useState(false)
  useEffect(() => {
    if (wsState === 'open') {
      if (wasOpen) toast.success('Live connection restored')
      setWasOpen(true)
    } else if (wsState === 'closed' && wasOpen) {
      toast.warning('Live connection lost', 'Retrying automatically…')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsState])

  const online = [...bots.values()].filter((b) => b.status === 'in_game').length
  const badge = (id: Page) => (id === 'bots' && bots.size > 0 ? `${online}/${bots.size}` : undefined)

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      {/* Desktop / tablet navigation rail */}
      <aside className="hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex md:w-[68px] lg:w-56">
        <div className="flex h-14 items-center gap-2.5 px-4 md:justify-center lg:justify-start">
          <LogoMark />
          <span className="hidden text-base font-semibold tracking-tight lg:block">Mori</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2.5 py-2" aria-label="Main">
          {NAV.map((item) => (
            <RailLink
              key={item.id}
              item={item}
              active={page === item.id}
              badge={badge(item.id)}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-sidebar-border p-2.5">
          <ConnectionPill state={wsState} />
          <RailAction
            label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            icon={theme === 'dark' ? Sun : Moon}
            onClick={toggle}
          />
          <RailAction label="Log out" icon={LogOut} onClick={onLogout} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 md:hidden">
        <LogoMark className="size-7 rounded-lg text-sm" />
        <h1 className="flex-1 truncate text-sm font-semibold">{PAGE_TITLE[page]}</h1>
        <ConnectionPill state={wsState} compact />
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggle}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        <button
          type="button"
          aria-label="Log out"
          onClick={onLogout}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-[18px]" />
        </button>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {page === 'bots' && <BotsPage />}
        {page === 'items' && <ItemsPage />}
        {page === 'proxy' && <ProxyPage />}
        {page === 'docs' && <DocsPage />}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="pb-safe grid shrink-0 grid-cols-4 border-t border-border bg-card md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active = page === item.id
          const b = badge(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-primary" />}
              <span className="relative">
                <item.icon className="size-5" />
                {b && (
                  <span className="tabular absolute -top-2 left-3 rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
                    {b}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function RailLink({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem
  active: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <Hint label={item.label} side="right">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors md:justify-center lg:justify-start',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
        )}
      >
        {active && (
          <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r bg-primary" aria-hidden />
        )}
        <item.icon className={cn('size-[18px] shrink-0', active && 'text-primary')} />
        <span className="hidden flex-1 text-left lg:block">{item.label}</span>
        {badge && (
          <span className="tabular hidden rounded-full bg-muted px-2 text-xs leading-5 text-muted-foreground lg:block">
            {badge}
          </span>
        )}
      </button>
    </Hint>
  )
}

function RailAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <Hint label={label} side="right">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground md:justify-center lg:justify-start"
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="hidden lg:block">{label}</span>
      </button>
    </Hint>
  )
}

function ConnectionPill({ state, compact }: { state: 'connecting' | 'open' | 'closed'; compact?: boolean }) {
  const meta = {
    open: { label: 'Live', tone: 'text-success', Icon: null as null },
    connecting: { label: 'Connecting…', tone: 'text-warning', Icon: Loader2 },
    closed: { label: 'Offline', tone: 'text-destructive', Icon: WifiOff },
  }[state]
  const title =
    state === 'open'
      ? 'Receiving live updates from the Mori backend'
      : state === 'connecting'
        ? 'Connecting to the Mori backend…'
        : 'Lost the live connection to the Mori backend, retrying'

  return (
    <div
      title={title}
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 text-xs font-medium',
        compact ? 'h-7 px-2 md:hidden' : 'h-9 md:justify-center lg:justify-start',
        meta.tone,
      )}
    >
      {meta.Icon ? (
        <meta.Icon className={cn('size-3.5 shrink-0', state === 'connecting' && 'animate-spin')} />
      ) : (
        <span className="relative inline-flex size-2 shrink-0">
          <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
          <span className="relative inline-block size-2 rounded-full bg-success" />
        </span>
      )}
      <span className={cn(compact ? 'hidden sm:inline' : 'hidden lg:inline')}>{meta.label}</span>
    </div>
  )
}
