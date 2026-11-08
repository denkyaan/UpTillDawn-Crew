export type TimesheetStatus = 'open' | 'submitted' | 'approved' | 'rejected' | 'locked'

export interface TimesheetApproval {
  userId: string
  eventId: string
  status: TimesheetStatus
  submittedAt?: number | null
  reviewedAt?: number | null
  reviewedBy?: string | null
  rejectionReason?: string | null
}

function validTimestamp(value: number | null | undefined): boolean {
  return value == null || (Number.isFinite(value) && value >= 0)
}

function validReviewHistory(timesheet: TimesheetApproval): boolean {
  if (!validTimestamp(timesheet.submittedAt) || !validTimestamp(timesheet.reviewedAt)) return false
  if (timesheet.reviewedAt != null && (timesheet.submittedAt == null || timesheet.reviewedAt < timesheet.submittedAt)) return false
  if (timesheet.submittedAt == null && timesheet.reviewedAt != null) return false
  if ((timesheet.reviewedAt != null) !== Boolean(timesheet.reviewedBy?.trim())) return false
  return true
}

function validTimesheetIdentity(timesheet: TimesheetApproval): boolean {
  return Boolean(timesheet.userId?.trim() && timesheet.eventId?.trim()) && validReviewHistory(timesheet)
}

export function timesheetCanSubmit(timesheet: TimesheetApproval): boolean {
  return validTimesheetIdentity(timesheet) && (timesheet.status === 'open' || (timesheet.status === 'rejected' && timesheet.reviewedAt != null && Boolean(timesheet.rejectionReason?.trim())))
}

export function timesheetCanReview(timesheet: TimesheetApproval): boolean {
  return validTimesheetIdentity(timesheet) && timesheet.status === 'submitted' && timesheet.submittedAt != null && timesheet.reviewedAt == null
}

export function timesheetCanLock(timesheet: TimesheetApproval): boolean {
  return validTimesheetIdentity(timesheet) && timesheet.status === 'approved' && timesheet.reviewedAt != null && Boolean(timesheet.reviewedBy?.trim())
}

export function rejectedTimesheetHasReason(timesheet: TimesheetApproval): boolean {
  return timesheet.status !== 'rejected' || Boolean(timesheet.rejectionReason?.trim())
}
