export type InventoryCondition = 'available' | 'issued' | 'damaged' | 'missing' | 'returned'

export interface InventoryItem {
  id: string
  name: string
  category?: string | null
  totalQuantity: number
  availableQuantity: number
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
