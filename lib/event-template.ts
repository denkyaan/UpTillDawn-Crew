export const EVENT_TEMPLATE_SECTIONS = ['workplaces','roles','shifts','briefing','tasks','checklists','responsibles','automations'] as const
export type EventTemplateSection = (typeof EVENT_TEMPLATE_SECTIONS)[number]

export interface EventTemplateSelection {
  sections: readonly EventTemplateSection[]
}

export function normalizeTemplateSelection(selection: EventTemplateSelection): EventTemplateSection[] {
  return EVENT_TEMPLATE_SECTIONS.filter((section) => selection.sections.includes(section))
}

export function templateIncludes(selection: EventTemplateSelection, section: EventTemplateSection): boolean {
  return selection.sections.includes(section)
}
