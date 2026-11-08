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
  return Boolean(correction.entryId?.trim() && correction.requestedBy?.trim() && correction.explanation?.trim()) &&
    ['forgot-check-in','forgot-check-out','wrong-time','break-correction','admin-correction'].includes(correction.reason) &&
    ((correction.approvedAt == null && !correction.approvedBy?.trim()) || (correction.approvedAt != null && Boolean(correction.approvedBy?.trim()) && Number.isFinite(correction.approvedAt) && correction.approvedAt >= 0)) &&
    Number.isSafeInteger(correction.originalMinutes) && correction.originalMinutes >= 0 &&
    Number.isSafeInteger(correction.correctedMinutes) && correction.correctedMinutes >= 0
}

export function timeCorrectionChangesValue(correction: TimeCorrection): boolean {
  return timeCorrectionIsValid(correction) && correction.originalMinutes !== correction.correctedMinutes
}

export function timeCorrectionIsApproved(correction: TimeCorrection): boolean {
  return timeCorrectionIsValid(correction) && Boolean(correction.approvedBy?.trim()) &&
    correction.approvedAt != null && Number.isFinite(correction.approvedAt) && correction.approvedAt >= 0
}
