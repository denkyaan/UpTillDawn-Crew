export type MigrationRisk = 'low' | 'medium' | 'high'

export interface MigrationPlan {
  id: string
  risk: MigrationRisk
  destructive: boolean
  reversible: boolean
  backupVerified: boolean
  dryRunPassed: boolean
}

export function migrationRequiresBackup(plan: MigrationPlan): boolean {
  return plan.destructive || plan.risk === 'high'
}

export function migrationCanApply(plan: MigrationPlan): boolean {
  if (!plan.dryRunPassed) return false
  if (migrationRequiresBackup(plan) && !plan.backupVerified) return false
  if (plan.destructive && !plan.reversible) return false
  return true
}
