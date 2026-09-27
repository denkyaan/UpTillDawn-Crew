export type AcknowledgementType = 'briefing' | 'urgent-update' | 'safety-message' | 'shift-change'

export interface Acknowledgement {
  userId: string
  entityId: string
  type: AcknowledgementType
  version: number
  acknowledgedAt: number
}

export function acknowledgementIsCurrent(acknowledgement: Acknowledgement, currentVersion: number): boolean {
  return acknowledgement.version >= currentVersion
}

export function usersMissingAcknowledgement(userIds: readonly string[], acknowledgements: readonly Acknowledgement[], entityId: string, currentVersion: number): string[] {
  return userIds.filter((userId) => !acknowledgements.some((acknowledgement) => acknowledgement.userId === userId && acknowledgement.entityId === entityId && acknowledgementIsCurrent(acknowledgement, currentVersion)))
}

export function acknowledgementCompletionRate(userIds: readonly string[], missingUserIds: readonly string[]): number {
  if (!userIds.length) return 1
  return Math.max(0, userIds.length - missingUserIds.length) / userIds.length
}
