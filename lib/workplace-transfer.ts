export interface WorkplaceTransfer {
  userId: string
  eventId: string
  originalWorkplaceId: string
  temporaryWorkplaceId: string
  startsAt: number
  endsAt?: number | null
  reason?: string | null
}

export function workplaceTransferIsValid(transfer: WorkplaceTransfer): boolean {
  return Boolean(transfer.userId?.trim() && transfer.eventId?.trim() && transfer.originalWorkplaceId?.trim() && transfer.temporaryWorkplaceId?.trim()) &&
    transfer.originalWorkplaceId !== transfer.temporaryWorkplaceId &&
    Number.isFinite(transfer.startsAt) &&
    (transfer.endsAt == null || (Number.isFinite(transfer.endsAt) && transfer.endsAt > transfer.startsAt))
}

export function workplaceForTime(originalWorkplaceId: string, transfers: readonly WorkplaceTransfer[], at: number): string {
  if (!Number.isFinite(at) || !originalWorkplaceId?.trim()) return originalWorkplaceId
  const active = transfers
    .filter((transfer) => workplaceTransferIsValid(transfer) && transfer.originalWorkplaceId === originalWorkplaceId && transfer.startsAt <= at && (transfer.endsAt == null || transfer.endsAt > at))
    .sort((a, b) => b.startsAt - a.startsAt)[0]
  return active?.temporaryWorkplaceId ?? originalWorkplaceId
}
