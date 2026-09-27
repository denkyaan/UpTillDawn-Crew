export const EVENT_PHASES = ['draft','planning','published','setup','live','teardown','closed','archived'] as const
export type EventPhase = (typeof EVENT_PHASES)[number]

const NEXT_PHASES: Record<EventPhase, readonly EventPhase[]> = {
  draft: ['planning'],
  planning: ['draft', 'published'],
  published: ['planning', 'setup', 'live'],
  setup: ['live'],
  live: ['teardown', 'closed'],
  teardown: ['closed'],
  closed: ['archived'],
  archived: [],
}

export function canTransitionEvent(from: EventPhase, to: EventPhase): boolean {
  return NEXT_PHASES[from].includes(to)
}

export function eventIsOperational(phase: EventPhase): boolean {
  return phase === 'setup' || phase === 'live' || phase === 'teardown'
}

export function eventIsEditable(phase: EventPhase): boolean {
  return phase !== 'archived'
}
