export interface PaginationRequest {
  cursor?: string | null
  limit?: number | null
}

export interface PaginationConfig {
  defaultLimit: number
  maximumLimit: number
}

export const DEFAULT_PAGINATION: PaginationConfig = { defaultLimit: 50, maximumLimit: 200 }

export function paginationLimit(request: PaginationRequest, config = DEFAULT_PAGINATION): number {
  const requested = request.limit == null ? config.defaultLimit : Math.floor(request.limit)
  return Math.max(1, Math.min(config.maximumLimit, requested))
}

export function paginationCursor(request: PaginationRequest): string | null {
  const cursor = request.cursor?.trim()
  return cursor ? cursor : null
}
