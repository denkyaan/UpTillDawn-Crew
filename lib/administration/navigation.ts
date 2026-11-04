export const administrationNavigationGroups = [
 {key:"overview",title:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},slugs:["dashboard"]},
 {key:"planning",title:{nl:"Planning",fr:"Planification",en:"Planning",de:"Planung"},slugs:["events","artists","contracts","staff","tasks","rosters","timesheets"]},
 {key:"finance",title:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"},slugs:["finance","invoices","banking","ticketing","reports","sales"]},
 {key:"operations",title:{nl:"Operaties",fr:"Opérations",en:"Operations",de:"Betrieb"},slugs:["inventory","logistics","documents","permits"]},
 {key:"relations",title:{nl:"Relaties",fr:"Relations",en:"Relations",de:"Kontakte"},slugs:["personnel","chat","contacts","sponsors","marketing"]},
 {key:"management",title:{nl:"Beheer",fr:"Gestion",en:"Management",de:"Verwaltung"},slugs:["notifications","automations","ai","promotion-discipline","settings","profile"]},
] as const

export function administrationRoute(slug:string):string {
 if(slug==="dashboard")return "/portals/administration"
 if(["personnel","chat","finance","rosters","promotion-discipline","timesheets","profile","sales"].includes(slug))return "/portals/administration/"+slug

 return "/portals/administration/modules/"+slug
}

export function administrationCategoryForPath(pathname:string):string {
 if(pathname==="/portals/administration/sales")return "finance"
 if(pathname.startsWith("/portals/administration/modules/artists/"))return "planning"
 if(pathname.startsWith("/portals/administration/modules/invoices/"))return "finance"
 if(pathname==="/portals/administration/profile")return "management"
 if(pathname==="/portals/administration/timesheets")return "planning"
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
 if(url.pathname==="/portals/administration"||url.pathname.startsWith("/portals/administration/"))return value
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
