export const TASK_STATUSES = ['open','in-progress','blocked','completed','cancelled'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  open: ['in-progress','blocked','completed','cancelled'],
  'in-progress': ['open','blocked','completed','cancelled'],
  blocked: ['open','in-progress','cancelled'],
  completed: ['open'],
  cancelled: ['open'],
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS,from) && TRANSITIONS[from].includes(to)
}

export function taskIsActionable(status: TaskStatus): boolean {
  return status === 'open' || status === 'in-progress' || status === 'blocked'
}

export function taskIsOverdue(status: TaskStatus, dueAt: number | null | undefined, now = Date.now()): boolean {
  return taskIsActionable(status) && dueAt != null && Number.isFinite(dueAt) && dueAt >= 0 && Number.isFinite(now) && now >= 0 && dueAt < now
}
