import { useState, type ComponentType, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BotStatus } from '@/lib/api'
import { statusMeta, TONE_BADGE, TONE_DOT } from '@/lib/status'

// ── Status ──────────────────────────────────────────────────────────────────

/** Colored dot; pulses while the bot is online or actively connecting. */
export function StatusDot({ status, className }: { status: BotStatus; className?: string }) {
  const meta = statusMeta(status)
  const live = status === 'in_game' || meta.busy
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {live && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping-soft',
            TONE_DOT[meta.tone],
          )}
        />
      )}
      <span className={cn('relative inline-block size-2 rounded-full', TONE_DOT[meta.tone])} />
    </span>
  )
}

export function StatusBadge({ status, className }: { status: BotStatus; className?: string }) {
  const meta = statusMeta(status)
  return (
    <span
      title={meta.hint}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
        TONE_BADGE[meta.tone],
        className,
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  )
}

// ── Layout helpers ──────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  title,
  hint,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  hint?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {(title || actions) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && <h2 className="truncate text-sm font-semibold">{title}</h2>}
            {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  sub,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: 'neutral' | 'success' | 'warning' | 'info' | 'danger'
  sub?: ReactNode
  className?: string
}) {
  const toneCls = {
    neutral: 'text-muted-foreground bg-muted',
    success: 'text-success bg-success/12',
    warning: 'text-warning bg-warning/12',
    info: 'text-info bg-info/12',
    danger: 'text-destructive bg-destructive/12',
  }[tone]
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3.5', className)}>
      {Icon && (
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toneCls)}>
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="tabular truncate text-xl font-semibold leading-tight">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground">
          <Icon className="size-6" />
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/** Small key/value row used in summary cards. */
export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  )
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={run}
            disabled={busy}
            autoFocus
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Formats a number compactly for dense UI (1.2k, 3.4M). */
export function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
