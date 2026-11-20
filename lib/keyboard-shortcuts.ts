import type { Permission } from './permission-matrix'

export interface KeyboardShortcut {
  id: string
  key: string
  ctrlOrMeta?: boolean
  shift?: boolean
  requiredPermission?: Permission
  enabled: boolean
}

export function shortcutIsAvailable(shortcut: KeyboardShortcut, permissions: ReadonlySet<Permission>): boolean {
  return shortcut.enabled && (!shortcut.requiredPermission || permissions.has(shortcut.requiredPermission))
}

export function shortcutSignature(shortcut: KeyboardShortcut): string {
  return [shortcut.ctrlOrMeta ? 'mod' : '', shortcut.shift ? 'shift' : '', shortcut.key.toLocaleLowerCase()].filter(Boolean).join('+')
}

export function shortcutsHaveCollision(shortcuts: readonly KeyboardShortcut[]): boolean {
  const signatures = shortcuts.filter((shortcut) => shortcut.enabled).map(shortcutSignature)
  return new Set(signatures).size !== signatures.length
}
