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
  if(!shiftChangeIsActionable(request)||!request.id?.trim()||!request.shiftId?.trim()||!request.requesterId?.trim()||!Number.isFinite(request.createdAt)||request.createdAt<0)return false
  if(!['swap','replacement','claim-open-shift'].includes(request.type))return false
  if(!shiftChangeNeedsReplacement(request))return request.replacementUserId==null || request.replacementUserId.trim()===''
  const replacement=request.replacementUserId?.trim()
  return Boolean(replacement&&replacement!==request.requesterId.trim())
}
