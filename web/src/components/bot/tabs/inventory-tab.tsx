import { useMemo, useState } from 'react'
import { ArrowDownToLine, Backpack, Shirt, Trash2 } from 'lucide-react'
import type { InventoryItem } from '@/lib/api'
import type { LiveBot } from '@/lib/store'
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
import { Card, EmptyState } from '@/components/common'
import { runCmd } from '../bot-actions'
import { DataTable, type DataRow } from '../data-table'
import { useItemLabel } from '../use-item-label'

/** World Lock, Diamond Lock, Blue Gem Lock, Black Gem Lock: valuable, easy to lose by mistake. */
const VALUABLE_IDS = new Set([242, 1796, 7188, 11550])

type Pending = { kind: 'drop' | 'trash'; item: InventoryItem } | null

export function InventoryTab({ bot }: { bot: LiveBot }) {
  const itemLabel = useItemLabel()
  const [pending, setPending] = useState<Pending>(null)

  const sorted = useMemo(
    () => [...bot.inventory].sort((a, b) => b.amount - a.amount),
    [bot.inventory],
  )

  const rows: DataRow[] = sorted.map((i) => ({
    key: i.item_id,
    search: itemLabel(i.item_id),
    cells: [
      <span key="n" className="flex items-center gap-2">
        {i.is_active && (
          <span
            className="rounded bg-primary/15 px-1.5 text-[11px] leading-5 font-medium text-primary"
            title="Currently worn"
          >
            worn
          </span>
        )}
        <span className="truncate">{itemLabel(i.item_id)}</span>
      </span>,
      i.amount.toLocaleString(),
      <div key="a" className="flex justify-end gap-1">
        {i.action_type === 20 &&
          (i.is_active ? (
            <Button
              size="xs"
              variant="secondary"
              onClick={() =>
                runCmd(bot.id, { type: 'unwear', item_id: i.item_id }, { error: 'Could not take it off' })
              }
            >
              <Shirt />
              <span className="hidden sm:inline">Unwear</span>
            </Button>
          ) : (
            <Button
              size="xs"
              variant="secondary"
              onClick={() =>
                runCmd(bot.id, { type: 'wear', item_id: i.item_id }, { error: 'Could not wear it' })
              }
            >
              <Shirt />
              <span className="hidden sm:inline">Wear</span>
            </Button>
          ))}
        <Button
          size="xs"
          variant="ghost"
          aria-label={`Drop ${itemLabel(i.item_id)}`}
          onClick={() => setPending({ kind: 'drop', item: i })}
        >
          <ArrowDownToLine />
          <span className="hidden sm:inline">Drop</span>
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label={`Trash ${itemLabel(i.item_id)}`}
          onClick={() => setPending({ kind: 'trash', item: i })}
        >
          <Trash2 />
          <span className="hidden sm:inline">Trash</span>
        </Button>
      </div>,
    ],
  }))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <Card
        title="Inventory"
        hint={bot.inventory_slots > 0 ? `${bot.inventory.length} of ${bot.inventory_slots} slots used` : undefined}
      >
        {bot.inventory.length === 0 ? (
          <EmptyState
            icon={Backpack}
            title="The backpack is empty"
            description="Items appear here once the bot is online."
            className="py-8"
          />
        ) : (
          <DataTable
            columns={[
              { label: 'Item' },
              { label: 'Amount', align: 'right' },
              { label: 'Actions', align: 'right' },
            ]}
            rows={rows}
            empty="Empty"
            searchPlaceholder="Search items"
            maxHeight="max-h-[60vh]"
          />
        )}
      </Card>
      <AmountDialog bot={bot} pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}

function AmountDialog({
  bot,
  pending,
  onClose,
}: {
  bot: LiveBot
  pending: Pending
  onClose: () => void
}) {
  const itemLabel = useItemLabel()
  const [raw, setRaw] = useState('1')
  const [busy, setBusy] = useState(false)

  // Always read the live amount so the dialog stays correct while items change.
  const live = pending ? bot.inventory.find((i) => i.item_id === pending.item.item_id) : undefined
  const max = live?.amount ?? pending?.item.amount ?? 0
  const amount = Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)))
  const valuable = pending ? VALUABLE_IDS.has(pending.item.item_id) : false
  const trash = pending?.kind === 'trash'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pending || amount < 1) return
    setBusy(true)
    const ok = await runCmd(
      bot.id,
      { type: pending.kind, item_id: pending.item.item_id, count: amount },
      {
        success: `${trash ? 'Trashed' : 'Dropped'} ${amount.toLocaleString()} × ${itemLabel(pending.item.item_id)}`,
        error: trash ? 'Could not trash the item' : 'Could not drop the item',
      },
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o && !busy) onClose()
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={() => setRaw('1')}
      >
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>
              {trash ? 'Trash' : 'Drop'} {pending ? itemLabel(pending.item.item_id) : ''}
            </DialogTitle>
            <DialogDescription>
              {trash
                ? 'Trashed items are destroyed and cannot be recovered.'
                : 'The item is dropped on the ground where the bot is standing.'}
            </DialogDescription>
          </DialogHeader>

          {valuable && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              This is a lock. Make sure you really want to {trash ? 'destroy' : 'drop'} it.
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Amount (you have {max.toLocaleString()})</span>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={max}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="tabular"
                inputMode="numeric"
              />
              <Button type="button" variant="outline" onClick={() => setRaw(String(max))}>
                All
              </Button>
            </div>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={trash ? 'destructive' : 'default'}
              disabled={busy || amount < 1}
            >
              {trash ? 'Trash' : 'Drop'} {amount > 0 ? amount.toLocaleString() : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
