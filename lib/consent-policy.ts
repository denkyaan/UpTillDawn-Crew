export type ConsentType = 'push-notifications' | 'location' | 'analytics' | 'camera' | 'offline-storage'

export interface ConsentRecord {
  userId: string
  type: ConsentType
  granted: boolean
  policyVersion: string
  updatedAt: number
}

export function consentIsCurrent(record: ConsentRecord, currentPolicyVersion: string): boolean {
  return record.policyVersion === currentPolicyVersion
}

export function capabilityHasConsent(records: readonly ConsentRecord[], userId: string, type: ConsentType, currentPolicyVersion: string): boolean {
  const record = [...records].reverse().find((candidate) => candidate.userId === userId && candidate.type === type)
  return Boolean(record?.granted && consentIsCurrent(record, currentPolicyVersion))
}
