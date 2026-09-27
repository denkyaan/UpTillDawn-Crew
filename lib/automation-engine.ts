export type AutomationTrigger = 'shift-starting' | 'shift-started' | 'shift-ended' | 'break-started' | 'task-overdue' | 'briefing-updated' | 'incident-created' | 'occupancy-changed' | 'event-phase-changed'
export type AutomationAction = 'notify-user' | 'notify-responsible' | 'notify-admin' | 'create-task' | 'reset-briefing-confirmation' | 'escalate-incident'

export interface AutomationRule {
  id: string
  enabled: boolean
  trigger: AutomationTrigger
  action: AutomationAction
  delayMinutes?: number
  eventId?: string | null
  workplaceId?: string | null
}

export interface AutomationContext {
  trigger: AutomationTrigger
  eventId?: string | null
  workplaceId?: string | null
}

export function matchingAutomationRules(rules: readonly AutomationRule[], context: AutomationContext): AutomationRule[] {
  return rules.filter((rule) => rule.enabled && rule.trigger === context.trigger && (!rule.eventId || rule.eventId === context.eventId) && (!rule.workplaceId || rule.workplaceId === context.workplaceId))
}

export function automationDueAt(triggeredAt: number, rule: AutomationRule): number {
  return triggeredAt + Math.max(0, rule.delayMinutes ?? 0) * 60_000
}
