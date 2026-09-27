export type ChecklistKind = 'opening' | 'closing' | 'safety' | 'custom'

export interface ChecklistItem {
  id: string
  label: string
  required: boolean
  requiresPhoto?: boolean
  completedAt?: number | null
  photoAttached?: boolean
}

export interface OperationalChecklist {
  id: string
  kind: ChecklistKind
  items: readonly ChecklistItem[]
}

export function checklistItemIsComplete(item: ChecklistItem): boolean {
  if (!item.completedAt) return false
  if (item.requiresPhoto && !item.photoAttached) return false
  return true
}

export function checklistCanClose(checklist: OperationalChecklist): boolean {
  return checklist.items.filter((item) => item.required).every(checklistItemIsComplete)
}

export function checklistCompletionRate(checklist: OperationalChecklist): number {
  if (!checklist.items.length) return 0
  return checklist.items.filter(checklistItemIsComplete).length / checklist.items.length
}
