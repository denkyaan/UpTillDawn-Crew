export interface BriefingVersion {
  id: string
  eventId: string
  version: number
  publishedAt: number
  requiresReconfirmation: boolean
}

export interface BriefingConfirmation {
  userId: string
  briefingVersion: number
  confirmedAt: number
}

export function briefingNeedsConfirmation(version: BriefingVersion, confirmation?: BriefingConfirmation | null): boolean {
  if (!Number.isSafeInteger(version.version) || version.version < 1 || !version.id?.trim() || !version.eventId?.trim() || !Number.isFinite(version.publishedAt) || version.publishedAt < 0) return true
  if (!confirmation || !confirmation.userId?.trim() || !Number.isSafeInteger(confirmation.briefingVersion) || confirmation.briefingVersion < 1 || !Number.isFinite(confirmation.confirmedAt) || confirmation.confirmedAt < 0) return true
  if (confirmation.briefingVersion > version.version) return true
  if (confirmation.confirmedAt < version.publishedAt && confirmation.briefingVersion === version.version) return true
  if (confirmation.confirmedAt < version.publishedAt && confirmation.briefingVersion >= version.version) return true
  if (confirmation.briefingVersion < version.version) return version.requiresReconfirmation
  return false
}

export function nextBriefingVersion(currentVersion: number): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 0 || currentVersion >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid briefing version')
  return currentVersion + 1
}
