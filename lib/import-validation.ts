export type ImportEntity = 'staff' | 'shifts' | 'workplaces' | 'planning' | 'inventory'

export interface ImportRowResult<T> {
  row: number
  value?: T
  errors: readonly string[]
}

export interface ImportPreview<T> {
  entity: ImportEntity
  rows: readonly ImportRowResult<T>[]
  validCount: number
  invalidCount: number
  canCommit: boolean
}

export function buildImportPreview<T>(entity: ImportEntity, rows: readonly ImportRowResult<T>[]): ImportPreview<T> {
  const invalidCount = rows.filter((row) => row.errors.length > 0).length
  return {
    entity,
    rows,
    validCount: rows.length - invalidCount,
    invalidCount,
    canCommit: rows.length > 0 && invalidCount === 0,
  }
}
