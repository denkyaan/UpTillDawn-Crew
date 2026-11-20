export type ImportDataset = 'staff' | 'workplaces' | 'shifts' | 'tasks'
export type ImportMode = 'validate-only' | 'create-only' | 'upsert'

export interface ImportRequest {
  dataset: ImportDataset
  mode: ImportMode
  organizationId: string
  actorId: string
  rowCount: number
  validationPassed: boolean
  confirmed: boolean
}

export function importRequiresConfirmation(request: ImportRequest): boolean {
  return request.mode !== 'validate-only'
}

export function importCanRun(request: ImportRequest): boolean {
  if (!request.organizationId.trim() || !request.actorId.trim()) return false
  if (request.rowCount <= 0 || !request.validationPassed) return false
  return !importRequiresConfirmation(request) || request.confirmed
}

export function importBatchCount(rowCount: number, batchSize = 250): number {
  return Math.ceil(Math.max(0, rowCount) / Math.max(1, batchSize))
}
