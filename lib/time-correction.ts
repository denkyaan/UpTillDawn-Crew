export type TimeCorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface TimeCorrectionRequest {
  id: string
  userId: string
  shiftId: string
  requestedStartAt?: number | null
  requestedEndAt?: number | null
  reason: string
  status: TimeCorrectionStatus
  createdAt: number
  reviewedBy?: string | null
  reviewedAt?: number | null
}

export function timeCorrectionIsValid(request: TimeCorrectionRequest): boolean {
  if (!request.reason.trim()) return false
  if (request.requestedStartAt != null && request.requestedEndAt != null && request.requestedEndAt <= request.requestedStartAt) return false
  return request.requestedStartAt != null || request.requestedEndAt != null
}

export function timeCorrectionCanReview(request: TimeCorrectionRequest): boolean {
  return request.status === 'pending' && timeCorrectionIsValid(request)
}
