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
  return value == null || (Number.isSafeInteger(value) && value >= 0)
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

/** Pure state transitions. Authorization and atomic persistence belong to the server workflow. */
export function submitTimesheet(timesheet: TimesheetApproval, submittedAt: number): TimesheetApproval {
  if (!timesheetCanSubmit(timesheet) || !Number.isSafeInteger(submittedAt) || submittedAt < 0) throw new Error('Timesheet cannot be submitted')
  if (timesheet.submittedAt != null && submittedAt < timesheet.submittedAt) throw new Error('Submission timestamp precedes previous submission')
  if (timesheet.reviewedAt != null && submittedAt < timesheet.reviewedAt) throw new Error('Submission timestamp precedes previous review')
  return {...timesheet,status:'submitted',submittedAt,reviewedAt:null,reviewedBy:null,rejectionReason:null}
}

export function reviewTimesheet(timesheet: TimesheetApproval, decision: 'approved' | 'rejected', reviewerId: string, reviewedAt: number, reason?: string): TimesheetApproval {
  if (!timesheetCanReview(timesheet) || !['approved','rejected'].includes(decision)) throw new Error('Timesheet cannot be reviewed')
  if (!reviewerId?.trim() || reviewerId === timesheet.userId) throw new Error('Invalid timesheet reviewer')
  if (!Number.isSafeInteger(reviewedAt) || reviewedAt < timesheet.submittedAt!) throw new Error('Invalid review timestamp')
  if (decision === 'rejected' && !reason?.trim()) throw new Error('Timesheet rejection requires a reason')
  return {...timesheet,status:decision,reviewedAt,reviewedBy:reviewerId,rejectionReason:decision==='rejected'?reason!.trim():null}
}

export function lockTimesheet(timesheet: TimesheetApproval): TimesheetApproval {
  if (!timesheetCanLock(timesheet)) throw new Error('Timesheet cannot be locked')
  return {...timesheet,status:'locked'}
}
