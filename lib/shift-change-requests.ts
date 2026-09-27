export type ShiftChangeType = 'swap' | 'replacement' | 'claim-open-shift'
export type ShiftChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface ShiftChangeRequest {
  id: string
  type: ShiftChangeType
  shiftId: string
  requesterId: string
  replacementUserId?: string | null
  status: ShiftChangeStatus
  createdAt: number
}

export function shiftChangeIsActionable(request: ShiftChangeRequest): boolean {
  return request.status === 'pending'
}

export function shiftChangeNeedsReplacement(request: ShiftChangeRequest): boolean {
  return request.type === 'swap' || request.type === 'replacement'
}

export function shiftChangeIsReadyForApproval(request: ShiftChangeRequest): boolean {
  return shiftChangeIsActionable(request) && (!shiftChangeNeedsReplacement(request) || Boolean(request.replacementUserId))
}
