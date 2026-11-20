export type PersonalDataClass = 'profile' | 'attendance' | 'incident' | 'audit' | 'document' | 'notification'

export interface RetentionRule {
  dataClass: PersonalDataClass
  retentionDays: number
  purgeMode: 'delete' | 'anonymize'
}

export function retentionCutoff(now: number, rule: RetentionRule): number {
  return now - Math.max(1, rule.retentionDays) * 86_400_000
}

export function shouldPurge(createdAt: number, now: number, rule: RetentionRule): boolean {
  return createdAt < retentionCutoff(now, rule)
}

export function minimizeProfile<T extends Record<string, unknown>>(profile: T, allowedFields: readonly (keyof T)[]): Partial<T> {
  const result: Partial<T> = {}
  for (const field of allowedFields) if (field in profile) result[field] = profile[field]
  return result
}
