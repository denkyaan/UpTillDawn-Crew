export type ProductSurface = 'crew' | 'operations' | 'control-center'
export type PlatformRole = 'employee' | 'responsible' | 'admin'

const SURFACES: Record<PlatformRole, readonly ProductSurface[]> = {
  employee: ['crew'],
  responsible: ['crew', 'operations'],
  admin: ['crew', 'operations', 'control-center'],
}

export function allowedProductSurfaces(role: PlatformRole): readonly ProductSurface[] {
  return SURFACES[role]
}

export function canUseProductSurface(role: PlatformRole, surface: ProductSurface): boolean {
  return SURFACES[role].includes(surface)
}

export function defaultProductSurface(role: PlatformRole, compactViewport: boolean): ProductSurface {
  if (role === 'admin' && !compactViewport) return 'control-center'
  if (role === 'responsible') return 'operations'
  return 'crew'
}
