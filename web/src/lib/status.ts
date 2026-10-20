import type { BotStatus } from './api'

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'pending'

export interface StatusMeta {
  label: string
  /** Short explanation shown in tooltips */
  hint: string
  tone: Tone
  /** Bot is actively trying to log in / reconnect */
  busy: boolean
}

export const STATUS_META: Record<BotStatus, StatusMeta> = {
  in_game: { label: 'Online', hint: 'Logged in and inside a world', tone: 'success', busy: false },
  connected: { label: 'Connected', hint: 'Connected to the game server, entering the game', tone: 'info', busy: true },
  connecting: { label: 'Connecting', hint: 'Logging in or waiting to retry', tone: 'pending', busy: true },
  stopped: { label: 'Stopped', hint: 'Saved bot, waiting for you to press Reconnect', tone: 'neutral', busy: false },
  two_factor_auth: { label: '2FA required', hint: 'Account protection is waiting for approval', tone: 'warning', busy: false },
  server_overloaded: { label: 'Server busy', hint: 'The game server is overloaded, the bot will retry', tone: 'warning', busy: false },
  too_many_logins: { label: 'Too many logins', hint: 'Login was rate limited, the bot will retry', tone: 'warning', busy: false },
  maintenance: { label: 'Maintenance', hint: 'The game server is under maintenance', tone: 'warning', busy: false },
  update_required: { label: 'Update required', hint: 'The game version is outdated, the client needs an update', tone: 'danger', busy: false },
}

export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  neutral: 'bg-muted-foreground/60',
  pending: 'bg-warning',
}

export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-success/12 text-success border-success/25',
  info: 'bg-info/12 text-info border-info/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-destructive/12 text-destructive border-destructive/25',
  neutral: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-warning/12 text-warning border-warning/25',
}

export function statusMeta(status: BotStatus): StatusMeta {
  return STATUS_META[status] ?? { label: status, hint: status, tone: 'neutral', busy: false }
}

/** Groups used by filters and the fleet summary. */
export type StatusGroup = 'online' | 'connecting' | 'stopped' | 'attention'

export function statusGroup(status: BotStatus): StatusGroup {
  switch (status) {
    case 'in_game':
      return 'online'
    case 'connecting':
    case 'connected':
      return 'connecting'
    case 'stopped':
      return 'stopped'
    default:
      return 'attention'
  }
}

export const GROUP_LABEL: Record<StatusGroup, string> = {
  online: 'Online',
  connecting: 'Connecting',
  stopped: 'Stopped',
  attention: 'Needs attention',
}
