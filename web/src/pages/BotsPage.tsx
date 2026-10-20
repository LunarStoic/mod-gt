import { useAtomValue } from 'jotai'
import { selectedBotAtom } from '@/lib/store'
import { BotDetail } from '@/components/bot/bot-detail'
import { BotPanel } from '@/components/bot/bot-panel'
import { FleetOverview } from '@/components/bot/fleet-overview'
import { AddBotDialog } from '@/components/bot/add-bot-dialog'

export function BotsPage() {
  const selected = useAtomValue(selectedBotAtom)

  return (
    <div className="flex h-full overflow-hidden">
      {selected ? (
        <>
          <div className="hidden h-full lg:block">
            <BotPanel />
          </div>
          <div className="h-full min-w-0 flex-1">
            <BotDetail key={selected.id} bot={selected} />
          </div>
        </>
      ) : (
        <div className="h-full min-w-0 flex-1">
          <FleetOverview />
        </div>
      )}
      <AddBotDialog />
    </div>
  )
}
