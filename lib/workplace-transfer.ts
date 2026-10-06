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
  return transfer.originalWorkplaceId !== transfer.temporaryWorkplaceId && (!transfer.endsAt || transfer.endsAt > transfer.startsAt)
}

export function workplaceForTime(originalWorkplaceId: string, transfers: readonly WorkplaceTransfer[], at: number): string {
  const active = transfers
    .filter((transfer) => transfer.originalWorkplaceId === originalWorkplaceId && transfer.startsAt <= at && (!transfer.endsAt || transfer.endsAt > at))
    .sort((a, b) => b.startsAt - a.startsAt)[0]
  return active?.temporaryWorkplaceId ?? originalWorkplaceId
}
