export interface QrTokenClaims {
  eventId: string
  workplaceId?: string | null
  shiftId?: string | null
  issuedAt: number
  expiresAt: number
  nonce: string
}

export function qrTokenClaimsAreValid(claims: QrTokenClaims, now = Date.now()): boolean {
  return Boolean(claims.eventId.trim() && claims.nonce.trim()) && claims.issuedAt <= now && claims.expiresAt > now && claims.expiresAt > claims.issuedAt
}

export function qrTokenLifetimeMs(claims: QrTokenClaims): number {
  return Math.max(0, claims.expiresAt - claims.issuedAt)
}

export function qrTokenIsShortLived(claims: QrTokenClaims, maximumMinutes = 5): boolean {
  return qrTokenLifetimeMs(claims) <= Math.max(1, maximumMinutes) * 60_000
}
