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
  if (!request.id?.trim() || !request.userId?.trim() || !request.shiftId?.trim() || !request.reason?.trim()) return false
  if (!Number.isFinite(request.createdAt) || request.createdAt < 0) return false
  if (request.requestedStartAt != null && (!Number.isFinite(request.requestedStartAt) || request.requestedStartAt < 0)) return false
  if (request.requestedEndAt != null && (!Number.isFinite(request.requestedEndAt) || request.requestedEndAt < 0)) return false
  if (request.reviewedAt != null && (!Number.isFinite(request.reviewedAt) || request.reviewedAt < request.createdAt)) return false
  if ((request.reviewedAt != null) !== Boolean(request.reviewedBy?.trim())) return false
  if (!['pending','approved','rejected','cancelled'].includes(request.status)) return false
  if (request.requestedStartAt != null && request.requestedEndAt != null && request.requestedEndAt <= request.requestedStartAt) return false
  return request.requestedStartAt != null || request.requestedEndAt != null
}

export function timeCorrectionCanReview(request: TimeCorrectionRequest): boolean {
  return request.status === 'pending' && request.reviewedAt == null && !request.reviewedBy?.trim() && timeCorrectionIsValid(request)
}
