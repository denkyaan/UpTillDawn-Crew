export const EVENT_TEMPLATE_SECTIONS = ['workplaces','roles','shifts','briefing','tasks','checklists','responsibles','automations'] as const
export type EventTemplateSection = (typeof EVENT_TEMPLATE_SECTIONS)[number]

export interface EventTemplateSelection {
  sections: readonly EventTemplateSection[]
}

export function normalizeTemplateSelection(selection: EventTemplateSelection): EventTemplateSection[] {
  if (!Array.isArray(selection.sections)) return []
  return EVENT_TEMPLATE_SECTIONS.filter((section) => selection.sections.includes(section))
}

export function templateIncludes(selection: EventTemplateSelection, section: EventTemplateSection): boolean {
  return Array.isArray(selection.sections) && EVENT_TEMPLATE_SECTIONS.includes(section) && selection.sections.includes(section)
}
