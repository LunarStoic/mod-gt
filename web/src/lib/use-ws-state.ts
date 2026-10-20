import { useSyncExternalStore } from 'react'
import { moriWs, type WsState } from './ws'

/** Live state of the dashboard <-> backend WebSocket. */
export function useWsState(): WsState {
  return useSyncExternalStore(moriWs.subscribeState, () => moriWs.state)
}
