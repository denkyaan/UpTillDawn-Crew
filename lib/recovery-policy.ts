export type RecoveryTier = 'critical' | 'important' | 'standard'

export interface RecoveryObjective {
  tier: RecoveryTier
  maxDataLossMinutes: number
  maxRecoveryMinutes: number
}

export const RECOVERY_OBJECTIVES: Record<RecoveryTier, RecoveryObjective> = {
  critical: { tier: 'critical', maxDataLossMinutes: 15, maxRecoveryMinutes: 60 },
  important: { tier: 'important', maxDataLossMinutes: 60, maxRecoveryMinutes: 240 },
  standard: { tier: 'standard', maxDataLossMinutes: 1440, maxRecoveryMinutes: 1440 },
}

export function recoveryObjective(tier: RecoveryTier): RecoveryObjective {
  return RECOVERY_OBJECTIVES[tier]
}

export function recoveryTargetMet(objective: RecoveryObjective, dataLossMinutes: number, recoveryMinutes: number): boolean {
  return dataLossMinutes <= objective.maxDataLossMinutes && recoveryMinutes <= objective.maxRecoveryMinutes
}
