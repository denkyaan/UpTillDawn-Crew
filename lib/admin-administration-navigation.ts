import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {administrationModules} from "@/lib/administration/modules"
import {administrationRoute} from "@/lib/administration/navigation"

/** The existing Admin categories expose distinct Administration workflows.
 * Shared workflows retain their sole existing shortcut (no duplicate entries).
 */
export const adminAdministrationSubtabs=[
 {key:"admin-artists",slug:"artists",group:"events"},
 {key:"admin-contracts",slug:"contracts",group:"events"},
 {key:"admin-rosters",slug:"rosters",group:"events"},
 {key:"admin-permits",slug:"permits",group:"events"},
 {key:"admin-timesheets",slug:"timesheets",group:"work"},
 {key:"admin-logistics",slug:"logistics",group:"work"},
 {key:"admin-promotion-tasks",slug:"promotion-tasks",group:"team"},
 {key:"admin-promotion-discipline",slug:"promotion-discipline",group:"team"},
 {key:"admin-counterparties",slug:"counterparties",group:"support"},
 {key:"admin-sponsors",slug:"sponsors",group:"support"},
 {key:"admin-marketing",slug:"marketing",group:"support"},
 {key:"admin-finance",slug:"finance",group:"manage"},
 {key:"admin-invoices",slug:"invoices",group:"manage"},
 {key:"admin-banking",slug:"banking",group:"manage"},
 {key:"admin-ticketing",slug:"ticketing",group:"manage"},
 {key:"admin-reports",slug:"reports",group:"manage"},
 {key:"admin-documents",slug:"documents",group:"manage"},
] as const

export const adminAdministrationGroupKeys={
 events:adminAdministrationSubtabs.filter(item=>item.group==="events").map(item=>item.key),
 work:adminAdministrationSubtabs.filter(item=>item.group==="work").map(item=>item.key),
 team:adminAdministrationSubtabs.filter(item=>item.group==="team").map(item=>item.key),
 support:adminAdministrationSubtabs.filter(item=>item.group==="support").map(item=>item.key),
 manage:adminAdministrationSubtabs.filter(item=>item.group==="manage").map(item=>item.key),
}
const specialTitles={
 rosters:{nl:"Werkroosters",fr:"Plannings",en:"Rosters",de:"Dienstpläne"},
 timesheets:{nl:"Ingediende werkuren",fr:"Heures soumises",en:"Submitted timesheets",de:"Eingereichte Stunden"},
 "promotion-tasks":{nl:"Promotietaken",fr:"Tâches promotionnelles",en:"Promotion tasks",de:"Promotionaufgaben"},
 "promotion-discipline":{nl:"Promotieblokkeringen",fr:"Blocages promotion",en:"Promotion restrictions",de:"Promotion-Sperren"},
 counterparties:{nl:"Relaties en factuurgegevens",fr:"Relations et facturation",en:"Counterparties and billing",de:"Geschäftspartner und Abrechnung"},
} as const

export function adminAdministrationLabel(key:string,locale:SupportedUiLocale):string|null{
 const entry=adminAdministrationSubtabs.find(item=>item.key===key)
 if(!entry)return null
 const special=specialTitles[entry.slug as keyof typeof specialTitles]
 return special?.[locale]??administrationModules.find(item=>item.slug===entry.slug)?.title[locale]??null
}
export function adminAdministrationHref(key:string):string|null{
 const entry=adminAdministrationSubtabs.find(item=>item.key===key)
 return entry?administrationRoute(entry.slug):null
}
