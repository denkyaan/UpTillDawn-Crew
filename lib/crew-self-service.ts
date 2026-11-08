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
  return Number.isSafeInteger(window.startsAt) && Number.isSafeInteger(window.endsAt) && window.endsAt > window.startsAt && ['available','unavailable','preferred'].includes(window.status)
}

export function canAcceptShift(response: ShiftResponseRecord): boolean {
  return Boolean(response.shiftId?.trim() && response.userId?.trim()) && Number.isFinite(response.updatedAt) && (response.response === 'pending' || response.response === 'declined')
}

export function declineRequiresReason(response: ShiftResponseRecord): boolean {
  return response.response === 'declined' && !response.reason?.trim()
}
