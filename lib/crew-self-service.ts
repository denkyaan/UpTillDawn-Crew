export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred'
export type ShiftResponse = 'pending' | 'accepted' | 'declined'

export interface AvailabilityWindow {
  startsAt: number
  endsAt: number
  status: AvailabilityStatus
}

export interface ShiftResponseRecord {
  shiftId: string
  userId: string
  response: ShiftResponse
  reason?: string | null
  updatedAt: number
}

export function availabilityWindowIsValid(window: AvailabilityWindow): boolean {
  return Number.isSafeInteger(window.startsAt) && window.startsAt >= 0 && Number.isSafeInteger(window.endsAt) && window.endsAt > window.startsAt && ['available','unavailable','preferred'].includes(window.status)
}

export function canAcceptShift(response: ShiftResponseRecord): boolean {
  return Boolean(response.shiftId?.trim() && response.userId?.trim()) && Number.isSafeInteger(response.updatedAt) && response.updatedAt >= 0 && (response.response === 'pending' || response.response === 'declined')
}

export function declineRequiresReason(response: ShiftResponseRecord): boolean {
  return response.response === 'declined' && !response.reason?.trim()
}

/** A response can only be submitted against an open, non-expired shift invitation. */
export function shiftResponseCanSubmit(response: ShiftResponseRecord, next: 'accepted' | 'declined', deadlineAt: number, now: number): boolean {
  if (!response.shiftId?.trim() || !response.userId?.trim() || !['pending','accepted','declined'].includes(response.response)) return false
  if (!Number.isSafeInteger(response.updatedAt) || response.updatedAt < 0) return false
  if (!Number.isSafeInteger(deadlineAt) || deadlineAt < 0 || !Number.isSafeInteger(now) || now < 0 || now > deadlineAt) return false
  if (response.updatedAt > now || response.response === next) return false
  if (next === 'declined' && !response.reason?.trim()) return false
  return next === 'accepted' || next === 'declined'
}

/** Overlap is half-open: adjacent availability windows do not conflict. */
export function availabilityWindowsOverlap(a: AvailabilityWindow, b: AvailabilityWindow): boolean {
  return availabilityWindowIsValid(a) && availabilityWindowIsValid(b) && a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

export function availabilityHasConflict(candidate: AvailabilityWindow, existing: readonly AvailabilityWindow[]): boolean {
  return !availabilityWindowIsValid(candidate) || existing.some(window => availabilityWindowsOverlap(candidate, window) && window.status !== candidate.status)
}
