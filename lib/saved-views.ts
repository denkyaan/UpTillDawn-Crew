export interface SavedView {
  id: string
  userId: string
  name: string
  entity: string
  filters: Readonly<Record<string, string | number | boolean>>
  sort?: { field: string; direction: 'asc' | 'desc' } | null
  visibleColumns?: readonly string[]
  createdAt: number
}

export function savedViewIsValid(view: SavedView): boolean {
  return Boolean(view.id.trim() && view.userId.trim() && view.name.trim() && view.entity.trim())
}

export function sanitizeVisibleColumns(columns: readonly string[], allowedColumns: ReadonlySet<string>): string[] {
  return [...new Set(columns)].filter((column) => allowedColumns.has(column))
}
