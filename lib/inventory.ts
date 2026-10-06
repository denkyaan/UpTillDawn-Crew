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
  if (item.availableQuantity <= 0) return 'empty'
  if (item.totalQuantity > 0 && item.availableQuantity / item.totalQuantity <= 0.2) return 'low'
  return 'available'
}

export function canIssueInventory(item: InventoryItem, quantity = 1): boolean {
  return quantity > 0 && item.availableQuantity >= quantity
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
  return values.every(value=>Number.isInteger(value)&&value>=0)
    && inventoryAccountedQuantity(item)===item.totalQuantity
}
