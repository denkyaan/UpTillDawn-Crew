import type { Permission } from './permission-matrix'
import type { ProductSurface } from './platform-capabilities'

export interface CommandDefinition {
  id: string
  label: string
  href?: string
  requiredPermission?: Permission
  surfaces: readonly ProductSurface[]
  keywords?: readonly string[]
}

export function visibleCommands(commands: readonly CommandDefinition[], surface: ProductSurface, permissions: ReadonlySet<Permission>): CommandDefinition[] {
  return commands.filter((command) => command.surfaces.includes(surface) && (!command.requiredPermission || permissions.has(command.requiredPermission)))
}

export function matchCommands(commands: readonly CommandDefinition[], query: string): CommandDefinition[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return [...commands]
  return commands.filter((command) => [command.label, ...(command.keywords ?? [])].some((value) => value.toLocaleLowerCase().includes(normalized)))
}
