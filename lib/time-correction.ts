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
  if (!Number.isSafeInteger(request.createdAt) || request.createdAt < 0) return false
  if (request.requestedStartAt != null && (!Number.isSafeInteger(request.requestedStartAt) || request.requestedStartAt < 0)) return false
  if (request.requestedEndAt != null && (!Number.isSafeInteger(request.requestedEndAt) || request.requestedEndAt < 0)) return false
  if (request.reviewedAt != null && (!Number.isSafeInteger(request.reviewedAt) || request.reviewedAt < request.createdAt)) return false
  if ((request.reviewedAt != null) !== Boolean(request.reviewedBy?.trim())) return false
  if (request.status === 'pending' && request.reviewedAt != null) return false
  if (['approved','rejected'].includes(request.status) && request.reviewedAt == null) return false
  if (request.status === 'cancelled' && request.reviewedAt != null) return false
  if (!['pending','approved','rejected','cancelled'].includes(request.status)) return false
  if (request.requestedStartAt != null && request.requestedEndAt != null && request.requestedEndAt <= request.requestedStartAt) return false
  return request.requestedStartAt != null || request.requestedEndAt != null
}

export function timeCorrectionCanReview(request: TimeCorrectionRequest): boolean {
  return request.status === 'pending' && request.reviewedAt == null && !request.reviewedBy?.trim() && timeCorrectionIsValid(request)
}

/** Pure review transition: persistence and authorization must be enforced by the caller. */
export function reviewTimeCorrection(request: TimeCorrectionRequest, decision: 'approved' | 'rejected', reviewerId: string, reviewedAt: number): TimeCorrectionRequest {
  if (!timeCorrectionCanReview(request)) throw new Error('Time correction is not reviewable')
  if (!reviewerId?.trim() || reviewerId === request.userId) throw new Error('Invalid time correction reviewer')
  if (!Number.isSafeInteger(reviewedAt) || reviewedAt < request.createdAt) throw new Error('Invalid time correction review timestamp')
  return {...request, status: decision, reviewedBy: reviewerId, reviewedAt}
}

/** A request owner can withdraw only a pending, unreviewed request. */
export function cancelTimeCorrection(request: TimeCorrectionRequest, actorId: string): TimeCorrectionRequest {
  if (!timeCorrectionCanReview(request) || actorId !== request.userId) throw new Error('Time correction cannot be cancelled')
  return {...request, status: 'cancelled'}
}
