/** Route only to implemented administrative workflows; never navigate back to the same module. */
export const administrationWorkflowLinks:Record<string,string>={
 artists:"/portals/administration/modules/artists/new",
 contracts:"/portals/administration/modules/artists",
 staff:"/portals/administration/rosters",
 invoices:"/portals/administration/finance",
 banking:"/portals/administration/finance",
 documents:"/portals/administration/finance",
 reports:"/portals/administration/finance",
 contacts:"/portals/administration/counterparties",
 sponsors:"/portals/administration/counterparties",
 logistics:"/portals/administration/modules/inventory",
 marketing:"/portals/administration/promotion-tasks",
 tasks:"#administration-work-queue"
}
export function administrationWorkflowHref(slug:string):string|null{
 const href=administrationWorkflowLinks[slug]
 return href&&href!=="/portals/administration/modules/"+slug?href:null
}
