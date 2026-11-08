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
  if (!item.id?.trim() || !item.label?.trim() || !Number.isFinite(item.completedAt) || item.completedAt! < 0) return false
  if (item.requiresPhoto && !item.photoAttached) return false
  return true
}

export function checklistCanClose(checklist: OperationalChecklist): boolean {
  if (!checklist.id?.trim() || !Array.isArray(checklist.items) || checklist.items.length === 0) return false
  const ids = checklist.items.map((item) => item.id?.trim())
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return false
  return checklist.items.filter((item) => item.required).every(checklistItemIsComplete)
}

export function checklistCompletionRate(checklist: OperationalChecklist): number {
  if (!Array.isArray(checklist.items) || !checklist.items.length) return 0
  return checklist.items.filter(checklistItemIsComplete).length / checklist.items.length
}
