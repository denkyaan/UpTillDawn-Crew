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

export function timesheetCanSubmit(timesheet: TimesheetApproval): boolean {
  return timesheet.status === 'open' || timesheet.status === 'rejected'
}

export function timesheetCanReview(timesheet: TimesheetApproval): boolean {
  return timesheet.status === 'submitted'
}

export function timesheetCanLock(timesheet: TimesheetApproval): boolean {
  return timesheet.status === 'approved'
}

export function rejectedTimesheetHasReason(timesheet: TimesheetApproval): boolean {
  return timesheet.status !== 'rejected' || Boolean(timesheet.rejectionReason?.trim())
}
