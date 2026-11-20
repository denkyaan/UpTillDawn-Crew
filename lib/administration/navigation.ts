export const administrationNavigationGroups = [
 {key:"overview",title:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},slugs:["dashboard"]},
 {key:"planning",title:{nl:"Planning",fr:"Planification",en:"Planning",de:"Planung"},slugs:["events","artists","contracts","tasks","rosters","timesheets","staff"]},
 {key:"finance",title:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"},slugs:["finance","invoices","banking","ticketing","reports","sales"]},
 {key:"operations",title:{nl:"Operaties",fr:"Opérations",en:"Operations",de:"Betrieb"},slugs:["inventory","logistics","documents","permits"]},
 {key:"relations",title:{nl:"Relaties",fr:"Relations",en:"Relations",de:"Kontakte"},slugs:["personnel","chat","counterparties","sponsors","marketing","promotion-tasks"]},
 {key:"management",title:{nl:"Beheer",fr:"Gestion",en:"Management",de:"Verwaltung"},slugs:["notifications","automations","ai","promotion-discipline","settings","profile"]},
] as const

export function administrationRoute(slug:string):string {
 if(slug==="dashboard")return "/portals/administration"
 if(slug==="counterparties"||slug==="promotion-tasks")return "/portals/administration/"+slug
 if(["personnel","chat","finance","rosters","promotion-discipline","timesheets","profile","sales"].includes(slug))return "/portals/administration/"+slug

 return "/portals/administration/modules/"+slug
}

export function administrationCategoryForPath(pathname:string):string {
 if(pathname==="/portals/administration/modules/contacts"||pathname.startsWith("/portals/administration/modules/contacts/"))return "relations"
 if(pathname==="/portals/administration/promotion-tasks"||pathname.startsWith("/portals/administration/promotion-tasks/"))return "relations"
 if(pathname==="/portals/administration/counterparties"||pathname.startsWith("/portals/administration/counterparties/"))return "relations"
 if(pathname==="/portals/administration/sales"||pathname.startsWith("/portals/administration/sales/"))return "finance"
 if(pathname.startsWith("/portals/administration/modules/artists/"))return "planning"
 if(pathname.startsWith("/portals/administration/modules/invoices/"))return "finance"
 if(pathname==="/portals/administration/profile"||pathname.startsWith("/portals/administration/profile/"))return "management"
 if(pathname==="/portals/administration/timesheets"||pathname.startsWith("/portals/administration/timesheets/"))return "planning"
 if(["/portals/administration/counterparties","/portals/administration/contacts"].includes(pathname))return "relations"
 return administrationNavigationGroups.find(group=>group.slugs.some(slug=>
  pathname===administrationRoute(slug)||(slug!=="dashboard"&&pathname.startsWith(administrationRoute(slug)+"/"))
 ))?.key??"overview"
}

/** Resolve shared notification targets without leaving the administration shell. */
export function administrationNotificationHref(value:string|null):string|null {
 if(!value?.startsWith("/")||value.startsWith("//")||value.includes("\\")||/[\u0000-\u001f\u007f]/.test(value)||/%2f|%5c|%2e/i.test(value))return null
 let url:URL
 try{url=new URL(value,"https://uptilldawn.local")}catch{return null}
 if(url.origin!=="https://uptilldawn.local")return null
 // Validate the raw path separately so legitimate encoded query parameters remain usable.
 // Reject double-encoded separators/traversal and encoded control characters before routing.
 const rawPath=value.split(/[?#]/,1)[0]
 if(/%(?:0[0-9a-f]|1[0-9a-f]|7f|25(?:0[0-9a-f]|1[0-9a-f]|7f|2e|2f|5c))/i.test(rawPath))return null
 // Permit harmless "/./" normalization, while rejecting parent traversal.
 if(rawPath.split("/").includes(".."))return null
 const normalizedPath=rawPath.replace(/\/\.\//g,"/").replace(/\/\.$/,"/")
 if(normalizedPath!==url.pathname)return null
 if(url.pathname==="/portals/administration/invoices")return administrationRoute("invoices")+url.search+url.hash
 // Preserve existing invoice detail pages for valid IDs; unknown legacy links fall back to the overview.
 const invoiceDetail=/^\/portals\/administration\/(?:modules\/)?invoices\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(url.pathname)
 const invoicePeppol=/^\/portals\/administration\/modules\/invoices\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/peppol$/i.exec(url.pathname)
 if(invoicePeppol)return url.pathname+url.search+url.hash
 if(invoiceDetail)return administrationRoute("invoices")+"/"+invoiceDetail[1]+url.search+url.hash
 if(url.pathname.startsWith("/portals/administration/invoices/"))return administrationRoute("invoices")+url.search+url.hash
 if(url.pathname.startsWith("/portals/administration/modules/invoices/"))return administrationRoute("invoices")+url.search+url.hash
 if(url.pathname==="/portals/administration")return url.pathname+url.search+url.hash
 const knownRoutes=administrationNavigationGroups.flatMap(group=>group.slugs.map(administrationRoute))
 if(knownRoutes.some(route=>route!=="/portals/administration"&&url.pathname===route))
  return url.pathname+url.search+url.hash
 // Only artists and invoices expose record detail pages; other module subpaths lead to 404.
 const artistBase=administrationRoute("artists")
 const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
 const artistDetail=new RegExp("^"+artistBase+"/"+uuid+"(?:/agreement(?:/signing-check/"+uuid+")?)?$","i")
 if(artistDetail.test(url.pathname))return url.pathname+url.search+url.hash
 // Invoice Peppol links are handled above, before the legacy invoice fallback.
 // Other portal URLs must never be followed from an administration notification.
 if(url.pathname.startsWith("/portals/"))return null
 const routes:Record<string,string>={
  "/notifications":administrationRoute("notifications"),"/settings":administrationRoute("profile"),
  "/tasks":administrationRoute("tasks"),"/chat":administrationRoute("chat"),
  "/timesheets":administrationRoute("timesheets"),"/inventory":administrationRoute("inventory"),
  "/sales":administrationRoute("sales"),"/events":administrationRoute("events"),"/crew":administrationRoute("personnel"),
 }
 const destination=routes[url.pathname]
 return destination?destination+url.search+url.hash:null
}
