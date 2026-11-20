export type KioskCapability = 'qr-check-in' | 'crew-search' | 'workplace-display' | 'badge-print'

export interface KioskPolicy {
  eventId: string
  capabilities: readonly KioskCapability[]
  exposeSensitiveData: false
}

export function kioskAllows(policy: KioskPolicy, capability: KioskCapability): boolean {
  return policy.capabilities.includes(capability)
}

export function controlRoomOccupancyLabel(name: string, active: number, target: number): string {
  return `${name} ${Math.max(0, active)}/${Math.max(0, target)}`
}
