import { useMemo, useState } from 'react'
import type { LiveBot } from '@/lib/store'
import { cn } from '@/lib/utils'
import { parseGTColors } from '@/lib/gt-colors'
import { Card } from '@/components/common'
import { DataTable, type DataRow } from '../data-table'
import { useItemLabel } from '../use-item-label'

export function WorldTab({ bot }: { bot: LiveBot }) {
  const itemLabel = useItemLabel()
  const inWorld = bot.status === 'in_game' && !!bot.world_name

  const players = useMemo(() => [...bot.players.values()], [bot.players])

  const playerRows: DataRow[] = players.map((p) => ({
    key: p.net_id,
    search: `${p.name.replace(/`./g, '')} ${p.net_id} ${p.country}`,
    cells: [
      <span key="n" dangerouslySetInnerHTML={{ __html: parseGTColors(p.name) }} />,
      p.net_id,
      p.country || '–',
    ],
  }))

  const tileRows = useMemo<DataRow[]>(() => {
    const counts = new Map<number, number>()
    for (const t of bot.tiles) {
      if (t.fg !== 0) counts.set(t.fg, (counts.get(t.fg) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        key: id,
        search: itemLabel(id),
        cells: [itemLabel(id), count.toLocaleString()],
      }))
  }, [bot.tiles, itemLabel])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      {!inWorld && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          The bot is not inside a world right now, so there is nothing to show yet.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Players" hint={`${players.length} in world`}>
          <DataTable
            columns={[{ label: 'Name' }, { label: 'Net ID', align: 'right' }, { label: 'Country' }]}
            rows={playerRows}
            empty="No other players in this world"
            searchPlaceholder="Search players"
          />
        </Card>

        <FloatingObjects bot={bot} />

        <Card
          title="Blocks in world"
          hint={`${tileRows.length} kinds`}
          className="lg:col-span-2"
        >
          <DataTable
            columns={[{ label: 'Block' }, { label: 'Count', align: 'right' }]}
            rows={tileRows}
            empty="No blocks"
            searchPlaceholder="Search blocks"
            maxHeight="max-h-96"
          />
        </Card>
      </div>
    </div>
  )
}

function FloatingObjects({ bot }: { bot: LiveBot }) {
  const itemLabel = useItemLabel()
  const [mode, setMode] = useState<'total' | 'each'>('total')
  const { objects } = bot

  const { totalRows, grand, kinds } = useMemo(() => {
    const totals = new Map<number, { amount: number; stacks: number }>()
    let grandTotal = 0
    for (const o of objects) {
      const entry = totals.get(o.item_id) ?? { amount: 0, stacks: 0 }
      entry.amount += o.count
      entry.stacks += 1
      totals.set(o.item_id, entry)
      grandTotal += o.count
    }
    const rows: DataRow[] = [...totals.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([id, t]) => ({
        key: id,
        search: itemLabel(id),
        cells: [itemLabel(id), t.amount.toLocaleString(), t.stacks],
      }))
    return { totalRows: rows, grand: grandTotal, kinds: totals.size }
  }, [objects, itemLabel])

  const eachRows: DataRow[] = objects.map((o) => ({
    key: o.uid,
    search: itemLabel(o.item_id),
    cells: [itemLabel(o.item_id), o.count, `${o.x.toFixed(1)}, ${o.y.toFixed(1)}`],
  }))

  return (
    <Card
      title="Floating items"
      hint={objects.length > 0 ? `${kinds} kinds · ${grand.toLocaleString()} total` : undefined}
      actions={
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Group by">
          {(['total', 'each'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'h-6 rounded-md px-2.5 text-xs font-medium transition-colors',
                mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'total' ? 'Per item' : 'Each drop'}
            </button>
          ))}
        </div>
      }
    >
      {mode === 'total' ? (
        <DataTable
          columns={[{ label: 'Item' }, { label: 'Total', align: 'right' }, { label: 'Stacks', align: 'right' }]}
          rows={totalRows}
          empty="Nothing on the ground"
          searchPlaceholder="Search items"
        />
      ) : (
        <DataTable
          columns={[{ label: 'Item' }, { label: 'Amount', align: 'right' }, { label: 'Position', align: 'right' }]}
          rows={eachRows}
          empty="Nothing on the ground"
          searchPlaceholder="Search items"
        />
      )}
    </Card>
  )
}
