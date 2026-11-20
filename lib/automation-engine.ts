export type AutomationTrigger =
  | 'shift-starting'
  | 'shift-started'
  | 'shift-ended'
  | 'break-started'
  | 'task-overdue'
  | 'briefing-updated'
  | 'incident-created'
  | 'occupancy-changed'
  | 'event-phase-changed'
  | 'runtime-check'
  | 'platform-check'
  | 'data-check'
  | 'account-pending'
  | 'event-starting'
  | 'event-ended'

export type AutomationAction =
  | 'notify-user'
  | 'notify-responsible'
  | 'notify-admin'
  | 'create-task'
  | 'create-alert'
  | 'reset-briefing-confirmation'
  | 'escalate-incident'

export type AutomationAudience='admin'|'responsible'|'staff'|'affected'|'all'
export type AutomationChannel='in_app'|'push'|'email'

export interface AutomationRule {
  automationKey:string
  label:string
  description:string
  enabled:boolean
  trigger:AutomationTrigger|string
  action:AutomationAction|string
  delayMinutes:number
  reminderMinutes?:number|null
  escalationMinutes?:number|null
  audience:AutomationAudience|string
  channels:AutomationChannel[]|string[]
  autoAction:boolean
  auditEnabled:boolean
  cooldownMinutes:number
  maxRetries:number
  settings:Record<string,unknown>
  lastRunAt?:string|null
  eventId?:string|null
  workplaceId?:string|null
}

export interface AutomationContext {
  trigger:AutomationTrigger|string
  eventId?:string|null
  workplaceId?:string|null
  userId?:string|null
}

export function matchingAutomationRules(rules:readonly AutomationRule[],context:AutomationContext):AutomationRule[]{
  return rules.filter(rule=>
    rule.enabled
    && rule.trigger===context.trigger
    && (!rule.eventId || rule.eventId === context.eventId)
    && (!rule.workplaceId || rule.workplaceId === context.workplaceId)
  )
}

export function automationDueAt(triggeredAt:number,rule:AutomationRule):number{
  return triggeredAt+Math.max(0,rule.delayMinutes||0)*60_000
}

export function automationIsNotificationOnly(rule:AutomationRule){
  return rule.action.startsWith('notify-')||rule.action==='create-alert'
}
