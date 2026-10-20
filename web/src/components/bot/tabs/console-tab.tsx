import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Copy, Search, TerminalSquare, X } from 'lucide-react'
import { parseGTColors } from '@/lib/gt-colors'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common'

/** Removes Growtopia color codes (`4, `w ...) to get plain text. */
function plain(line: string) {
  return line.replace(/`./g, '')
}

/** Hides login tokens that the backend may print, so they never sit on screen or in the clipboard. */
function redact(line: string) {
  return line.replace(/(ltoken string:\s*)\S+/i, '$1••••••••')
}

type Kind = 'error' | 'script' | 'status' | 'plain'

function classify(line: string): Kind {
  const t = plain(line)
  if (/^\[Lua/i.test(t) || /(error|failed|disconnected)/i.test(t)) return 'error'
  if (/^\[Script\]/i.test(t)) return 'script'
  if (/^\[(Status|Notice|Notification|Bubble)\]/i.test(t)) return 'status'
  return 'plain'
}

const KIND_CLASS: Record<Kind, string> = {
  error: 'text-destructive',
  script: 'text-info',
  status: 'text-muted-foreground',
  plain: 'text-foreground',
}

export function ConsoleTab({ lines }: { lines: string[] }) {
  const [query, setQuery] = useState('')
  const [stick, setStick] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    const safe = lines.map(redact)
    const q = query.trim().toLowerCase()
    if (!q) return safe
    return safe.filter((l) => plain(l).toLowerCase().includes(q))
  }, [lines, query])

  // Follow new output unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick) el.scrollTop = el.scrollHeight
  }, [visible, stick])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(visible.map(plain).join('\n'))
      toast.success('Console copied', `${visible.length} lines`)
    } catch {
      toast.error('Could not copy', 'Clipboard access was blocked by the browser.')
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter output"
            aria-label="Filter console output"
            className="h-8 pr-8 pl-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="tabular text-xs text-muted-foreground">
          {query ? `${visible.length} of ${lines.length}` : `${lines.length}`} lines
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy} disabled={visible.length === 0}>
            <Copy />
            Copy
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-auto rounded-xl border border-border bg-background p-3 font-mono text-[12.5px] leading-relaxed"
          role="log"
          aria-live="off"
          aria-label="Bot console"
        >
          {lines.length === 0 ? (
            <EmptyState
              icon={TerminalSquare}
              title="No output yet"
              description="Messages from the game, the bot and your scripts show up here."
              className="h-full"
            />
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No lines match “{query}”.</p>
          ) : (
            visible.map((line, i) => (
              <div
                key={i}
                className={cn('break-all whitespace-pre-wrap', KIND_CLASS[classify(line)])}
                dangerouslySetInnerHTML={{ __html: parseGTColors(line) }}
              />
            ))
          )}
        </div>
        {!stick && visible.length > 0 && (
          <Button
            size="sm"
            className="absolute right-4 bottom-4 shadow-lg"
            onClick={() => setStick(true)}
          >
            <ArrowDownToLine />
            Latest
          </Button>
        )}
      </div>
    </div>
  )
}
