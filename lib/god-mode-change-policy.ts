export type GodModeChangeRisk = 'low' | 'medium' | 'high' | 'critical'

export interface GodModeChange {
  id: string
  actorId: string
  target: string
  risk: GodModeChangeRisk
  before: Readonly<Record<string, unknown>>
  after: Readonly<Record<string, unknown>>
  previewedAt?: number | null
  appliedAt?: number | null
}

export function godModeChangeRequiresPreview(change: GodModeChange): boolean {
  return change.risk === 'high' || change.risk === 'critical'
}

export function godModeChangeCanApply(change: GodModeChange): boolean {
  return !godModeChangeRequiresPreview(change) || Boolean(change.previewedAt)
}

export function godModeChangeIsRollbackable(change: GodModeChange): boolean {
  return Object.keys(change.before).length > 0 && Boolean(change.appliedAt)
}
