export type MobileNavItem = 'events' | 'briefing' | 'shifts' | 'workplaces' | 'work-hours' | 'tasks' | 'help'
export type MobileOperationalRole = 'employee' | 'responsible'

export function mobileNavItems(role: MobileOperationalRole, activeShift: boolean): readonly MobileNavItem[] {
  if (!activeShift) return ['events','briefing','shifts','workplaces']
  if (role === 'responsible') return ['work-hours','shifts','workplaces','help']
  return ['work-hours','shifts','briefing','tasks']
}

export function mobileNavIsContextual(role: MobileOperationalRole): boolean {
  return role === 'employee' || role === 'responsible'
}
