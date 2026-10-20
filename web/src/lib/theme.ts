import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'mori_theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // storage unavailable: fall back to default
  }
  return 'dark'
}

let current: Theme = read()

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function initTheme() {
  current = read()
  apply(current)
}

export function setTheme(theme: Theme) {
  current = theme
  apply(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
