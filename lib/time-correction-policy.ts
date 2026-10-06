export type TimeCorrectionReason = 'forgot-check-in' | 'forgot-check-out' | 'wrong-time' | 'break-correction' | 'admin-correction'

export interface TimeCorrection {
  entryId: string
  requestedBy: string
  reason: TimeCorrectionReason
  explanation: string
  originalMinutes: number
  correctedMinutes: number
  approvedBy?: string | null
  approvedAt?: number | null
}

export function timeCorrectionIsValid(correction: TimeCorrection): boolean {
  return Boolean(correction.entryId.trim() && correction.requestedBy.trim() && correction.explanation.trim()) && correction.originalMinutes >= 0 && correction.correctedMinutes >= 0
}

export function timeCorrectionChangesValue(correction: TimeCorrection): boolean {
  return correction.originalMinutes !== correction.correctedMinutes
}

export function timeCorrectionIsApproved(correction: TimeCorrection): boolean {
  return Boolean(correction.approvedBy?.trim() && correction.approvedAt)
}
