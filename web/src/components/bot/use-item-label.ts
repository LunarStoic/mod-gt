import { useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { itemNamesAtom } from '@/lib/store'

/** Returns `Name (id)` when the item name is known, otherwise just the id. */
export function useItemLabel() {
  const names = useAtomValue(itemNamesAtom)
  return useCallback(
    (id: number) => {
      const name = names[String(id)]
      return name ? `${name} (${id})` : String(id)
    },
    [names],
  )
}

export function useItemName() {
  const names = useAtomValue(itemNamesAtom)
  return useCallback((id: number) => names[String(id)] ?? `Item ${id}`, [names])
}
