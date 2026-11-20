export type InventoryCondition = 'available' | 'issued' | 'damaged' | 'missing' | 'returned'

export interface InventoryItem {
  id: string
  name: string
  category?: string | null
  totalQuantity: number
  availableQuantity: number
  issuedQuantity?: number
  damagedQuantity?: number
  missingQuantity?: number
  eventId?: string | null
  workplaceId?: string | null
}

export function inventoryAvailability(item: InventoryItem): 'empty' | 'low' | 'available' {
  if (!inventoryCountsAreValid(item)) return 'empty'
  if (item.availableQuantity <= 0) return 'empty'
  if (item.totalQuantity > 0 && item.availableQuantity / item.totalQuantity <= 0.2) return 'low'
  return 'available'
}

export function canIssueInventory(item: InventoryItem, quantity = 1): boolean {
  return Boolean(item.id?.trim() && item.name?.trim()) && inventoryCountsAreValid(item) && Number.isSafeInteger(quantity) && quantity > 0 && item.availableQuantity >= quantity
}

export function inventoryAccountedQuantity(item: InventoryItem): number {
  return item.availableQuantity
    + (item.issuedQuantity ?? 0)
    + (item.damagedQuantity ?? 0)
    + (item.missingQuantity ?? 0)
}

export function inventoryCountsAreValid(item: InventoryItem): boolean {
  const values=[
    item.totalQuantity,
    item.availableQuantity,
    item.issuedQuantity ?? 0,
    item.damagedQuantity ?? 0,
    item.missingQuantity ?? 0,
  ]
  return values.every(value=>Number.isSafeInteger(value)&&value>=0)
    && inventoryAccountedQuantity(item)===item.totalQuantity
}

/** Pure inventory movements: callers must persist the updated item and audit trail atomically. */
export type InventoryMovementKind = 'issue' | 'return' | 'damage' | 'missing' | 'recover'

export function applyInventoryMovement(item: InventoryItem, kind: InventoryMovementKind, quantity: number): InventoryItem {
  if (!item.id?.trim() || !item.name?.trim() || !inventoryCountsAreValid(item)) throw new Error('Invalid inventory item')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid inventory movement quantity')
  const available = item.availableQuantity
  const issued = item.issuedQuantity ?? 0
  const damaged = item.damagedQuantity ?? 0
  const missing = item.missingQuantity ?? 0
  let next: InventoryItem
  switch (kind) {
    case 'issue':
      if (available < quantity) throw new Error('Insufficient available inventory')
      next = {...item, availableQuantity: available - quantity, issuedQuantity: issued + quantity}
      break
    case 'return':
      if (issued < quantity) throw new Error('Insufficient issued inventory')
      next = {...item, availableQuantity: available + quantity, issuedQuantity: issued - quantity}
      break
    case 'damage':
      if (issued < quantity) throw new Error('Insufficient issued inventory')
      next = {...item, issuedQuantity: issued - quantity, damagedQuantity: damaged + quantity}
      break
    case 'missing':
      if (issued < quantity) throw new Error('Insufficient issued inventory')
      next = {...item, issuedQuantity: issued - quantity, missingQuantity: missing + quantity}
      break
    case 'recover':
      if (missing < quantity) throw new Error('Insufficient missing inventory')
      next = {...item, missingQuantity: missing - quantity, availableQuantity: available + quantity}
      break
    default:
      throw new Error('Unsupported inventory movement')
  }
  if (!inventoryCountsAreValid(next)) throw new Error('Inventory movement violates quantity conservation')
  return next
}
