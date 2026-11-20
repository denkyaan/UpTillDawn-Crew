export interface FormDraft<T> {
  key: string
  userId: string
  value: T
  savedAt: number
  expiresAt: number
}

export function formDraftIsUsable<T>(draft: FormDraft<T>, userId: string, now = Date.now()): boolean {
  return draft.userId === userId && draft.expiresAt > now
}

export function formDraftLifetimeHours<T>(draft: FormDraft<T>): number {
  return Math.max(0, draft.expiresAt - draft.savedAt) / 3_600_000
}

export function formDraftShouldExpire<T>(draft: FormDraft<T>, now = Date.now()): boolean {
  return draft.expiresAt <= now
}
