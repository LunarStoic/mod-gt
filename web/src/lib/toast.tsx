import { atom, getDefaultStore, useAtomValue, useSetAtom } from 'jotai'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

const toastsAtom = atom<ToastItem[]>([])
let nextId = 1

function push(kind: ToastKind, title: string, description?: string, ms = 4200) {
  const store = getDefaultStore()
  const id = nextId++
  store.set(toastsAtom, (list) => [...list.slice(-3), { id, kind, title, description }])
  window.setTimeout(
    () => {
      store.set(toastsAtom, (list) => list.filter((t) => t.id !== id))
    },
    kind === 'error' ? ms + 2500 : ms,
  )
}

/** Imperative API usable from anywhere (event handlers, async callbacks). */
export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
  warning: (title: string, description?: string) => push('warning', title, description),
}

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
} as const

const TONE = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-info',
  warning: 'text-warning',
} as const

export function Toaster() {
  const items = useAtomValue(toastsAtom)
  const set = useSetAtom(toastsAtom)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-4 md:bottom-4 md:items-end md:px-0"
      role="region"
      aria-label="Notifications"
    >
      {items.map((t) => {
        const Icon = ICON[t.kind]
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border border-border bg-popover p-3 pr-2 text-popover-foreground shadow-lg"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => set((list) => list.filter((x) => x.id !== t.id))}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
