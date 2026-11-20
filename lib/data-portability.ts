export type PortabilityDataset = 'profile' | 'work-hours' | 'shift-history' | 'briefing-confirmations' | 'task-history'

export interface PortabilityRequest {
  userId: string
  organizationId: string
  datasets: readonly PortabilityDataset[]
  requestedAt: number
}

export function portabilityRequestIsValid(request: PortabilityRequest): boolean {
  return Boolean(request.userId.trim() && request.organizationId.trim() && request.datasets.length)
}

export function normalizePortabilityDatasets(datasets: readonly PortabilityDataset[]): PortabilityDataset[] {
  return [...new Set(datasets)]
}
