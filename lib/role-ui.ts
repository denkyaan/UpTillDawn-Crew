"use client"

import type { Json } from "@/types/crew-database"

export type RoleRuleRole = "staff" | "responsible_lead" | "admin"
export type RoleCondition =
  | "always"
  | "assigned_event"
  | "assigned_workplace_role"
  | "event_active"
  | "shift_active"
  | "never"

export type RoleUiRule = {
  role: RoleRuleRole
  feature_key: string
  label: string
  group_key: string
  visible: boolean
  enabled: boolean
  condition_key: RoleCondition
  sort_order: number
  settings?: Json | null
}

export type RoleUiContext = {
  assignedEvent: boolean
  assignedWorkplaceRole: boolean
  eventActive: boolean
  shiftActive: boolean
}

export function ruleMatches(
  rule: RoleUiRule | undefined,
  context: RoleUiContext,
  previewAll = false,
) {
  if (!rule) return false
  if (previewAll) return true
  if (!rule.visible) return false
  switch (rule.condition_key) {
    case "always": return true
    case "assigned_event": return context.assignedEvent
    case "assigned_workplace_role": return context.assignedWorkplaceRole
    case "event_active": return context.eventActive
    case "shift_active": return context.shiftActive
    case "never": return false
    default: return false
  }
}

export function ruleUsable(
  rule: RoleUiRule | undefined,
  context: RoleUiContext,
  previewAll = false,
) {
  if (!rule) return false
  if (previewAll) return true
  return rule.enabled && ruleMatches(rule, context, false)
}


const featureRule = (
  role: RoleRuleRole,
  feature_key: string,
  label: string,
  sort_order: number,
  condition_key: RoleCondition = "always",
  visible = true,
  enabled = true,
): RoleUiRule => ({
  role,
  feature_key,
  label,
  group_key: "operations",
  visible,
  enabled,
  condition_key,
  sort_order,
  settings: {},
})

const navRule = (
  role: RoleRuleRole,
  feature_key: string,
  label: string,
  sort_order: number,
  condition_key: RoleCondition = "always",
  visible = true,
  enabled = true,
): RoleUiRule => ({
  role,
  feature_key,
  label,
  group_key: "navigation",
  visible,
  enabled,
  condition_key,
  sort_order,
  settings: {},
})

export const ROLE_UI_DEFAULTS: Record<RoleRuleRole, RoleUiRule[]> = {
  admin: [
    navRule("admin","overview","Overzicht",10),
    navRule("admin","events","Evenementen",20),
    navRule("admin","workplaces","Werkplaatsen & shifts",30),
    navRule("admin","operations","Werkuren",40),
    navRule("admin","tasks","Taken",50),
    navRule("admin","sales","Sales",60),
    navRule("admin","personnel","Goedkeuringen",70),
    navRule("admin","crew","Personeel",80),
    navRule("admin","chat","Chats",90),
    navRule("admin","incidents","Help",100),
    navRule("admin","settings","Beheer",110),
    navRule("admin","shifts","Shift's",45,"never",false,false),
    navRule("admin","inventory","Inventaris",61,"never",false,false),
    navRule("admin","guestlist","Inkom & Guestlist",62,"never",false,false),
    navRule("admin","briefings","Briefing",63,"never",false,false),
    navRule("admin","exports","Excel",64,"never",false,false),
    navRule("admin","platform","Platformbeheer",65,"never",false,false),
    featureRule("admin","emergency","Noodinformatie",66,"never",false,false),
    featureRule("admin","documents","Documenten",67,"never",false,false),
  ],
  responsible_lead: [
    navRule("responsible_lead","overview","Overzicht",10),
    navRule("responsible_lead","operations","Mijn werkuren",20,"shift_active"),
    navRule("responsible_lead","events","Evenementen",30),
    navRule("responsible_lead","shifts","Shift's",45,"never",false,false),
    navRule("responsible_lead","tasks","Taken",50,"shift_active"),
    navRule("responsible_lead","briefings","Briefing",60,"assigned_event"),
    navRule("responsible_lead","workplaces","Werkplaatsen & shifts",40,"assigned_workplace_role"),
    navRule("responsible_lead","inventory","Inventaris",62,"assigned_workplace_role"),
    navRule("responsible_lead","guestlist","Inkom & Guestlist",65,"assigned_event"),
    navRule("responsible_lead","sales","Verkoop",67,"assigned_workplace_role"),
    navRule("responsible_lead","chat","Chat's",80),
    navRule("responsible_lead","crew","Personeel",90),
    navRule("responsible_lead","incidents","Help",100,"shift_active"),
    featureRule("responsible_lead","emergency","Noodinformatie",115),
    featureRule("responsible_lead","documents","Documenten",118),
  ],
  staff: [
    navRule("staff","overview","Overzicht",10),
    navRule("staff","operations","Mijn werkuren",20,"shift_active"),
    navRule("staff","events","Evenementen",30),
    navRule("staff","shifts","Mijn shift's",45,"never",false,false),
    navRule("staff","briefings","Briefing",50,"assigned_event"),
    navRule("staff","workplaces","Werkplaatsen & shifts",40,"assigned_event"),
    navRule("staff","tasks","Taken",70,"shift_active"),
    navRule("staff","inventory","Inventaris",62,"assigned_workplace_role"),
    navRule("staff","guestlist","Inkom & Guestlist",65,"assigned_event"),
    navRule("staff","sales","Verkoop",67,"assigned_workplace_role"),
    navRule("staff","chat","Chat's",80),
    navRule("staff","crew","Personeel",90),
    navRule("staff","incidents","Help",100,"shift_active"),
    featureRule("staff","emergency","Noodinformatie",115),
    featureRule("staff","documents","Documenten",118),
  ],
}

export function getDefaultRoleUiRules(role: RoleRuleRole) {
  return ROLE_UI_DEFAULTS[role].map(rule => ({ ...rule }))
}

export function getDefaultRoleUiLabel(
  role: RoleRuleRole,
  featureKey: string,
  fallback: string,
) {
  return ROLE_UI_DEFAULTS[role].find(rule => rule.feature_key === featureKey)?.label || fallback
}
