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
  if (!confirmation) return true
  if (confirmation.briefingVersion < version.version) return version.requiresReconfirmation
  return false
}

export function nextBriefingVersion(currentVersion: number): number {
  return Math.max(0, Math.floor(currentVersion)) + 1
}
