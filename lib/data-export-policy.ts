export type ExportFormat = 'csv' | 'xlsx' | 'pdf'
export type ExportDataset = 'work-hours' | 'planning' | 'staff' | 'incidents' | 'tasks' | 'event-report'

export interface ExportRequest {
  dataset: ExportDataset
  format: ExportFormat
  organizationId: string
  requestedBy: string
  includePersonalData: boolean
  reason?: string | null
}

export function exportRequiresReason(request: ExportRequest): boolean {
  return request.includePersonalData || request.dataset === 'incidents' || request.dataset === 'staff'
}

export function exportRequestIsValid(request: ExportRequest): boolean {
  return Boolean(request.organizationId.trim() && request.requestedBy.trim()) && (!exportRequiresReason(request) || Boolean(request.reason?.trim()))
}
