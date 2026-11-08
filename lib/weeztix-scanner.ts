/** Official vendor destinations; no scanner credentials belong in links or browser storage. */
export const WEEZTIX_SCANNER_LINKS={
 ios:'https://apps.apple.com/be/app/weeztix-ticket-scanner/id1327353743',
 android:'https://play.google.com/store/apps/details?id=com.scantickets.app.eventix',
 dashboard:'https://dashboard.weeztix.com',
 help:'https://weeztix.com/help/how-to-use-ticket-scanner-app',
} as const

/** Match entrance posts, without enabling ticket scanning on sales or backstage posts. */
export function isEntranceWorkplace(name:string):boolean{
 const normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')
 const entrance=new Set(['inkom','entrance','entree','eingang','toegang','ticket scan','ticket scanning','ticketscan','ticket scanner','ticketcontrole','ticketkontrolle','controle des billets'])
 const parts=normalized.split(/\s*(?:\/|&|\+|\||[-–—])\s*/)
 return parts.some(part=>entrance.has(part))&&parts.every(part=>entrance.has(part)||part==='guestlist'||part==='guest list')
}
