import Link from 'next/link'
import {redirect} from 'next/navigation'
import TimesheetsPage from '@/app/(app)/timesheets/page'
import {administrationAccess} from '@/lib/administration/access'
import {requestUiLocale} from '@/lib/server-locale'
import {translateRuntimeUi} from '@/lib/ui-translation-runtime'
import {nlStatus} from '@/lib/ui-nl'

export const dynamic='force-dynamic'

const PAGE_SIZE=25
const STATUSES=['open','submitted','approved','rejected','locked'] as const
type Search={event?:string;status?:string;page?:string}

export default async function AdministrationTimesheets({searchParams}:{searchParams:Promise<Search>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 if(access.user.realIsAdmin||access.user.isOwner)return TimesheetsPage({searchParams,navigationBasePath:'/portals/administration/timesheets'})
 const params=await searchParams
 const eventFilter=params.event&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.event)?params.event:null
 const statusFilter=STATUSES.find(status=>status===params.status)||null
 const requestedPage=params.page&&/^[1-9][0-9]{0,4}$/.test(params.page)?Number(params.page):1
 const page=Math.min(requestedPage,10000)
 const locale=await requestUiLocale()
 const t=({
  nl:{title:'Werkstaten',empty:'Geen werkstaten beschikbaar.',summary:'Werkstaatstatussen op deze pagina',error:'Werkstaten konden niet worden geladen.',all:'Alle',filter:'Status filteren',total:'Totaal',page:'Pagina',previous:'Vorige',next:'Volgende',event:'Evenement'},
  fr:{title:'Feuilles de temps',empty:'Aucune feuille disponible.',summary:'Statuts sur cette page',error:'Impossible de charger les feuilles de temps.',all:'Tous',filter:'Filtrer par statut',total:'Total',page:'Page',previous:'Précédent',next:'Suivant',event:'Événement'},
  en:{title:'Timesheets',empty:'No timesheets available.',summary:'Statuses on this page',error:'Unable to load timesheets.',all:'All',filter:'Filter by status',total:'Total',page:'Page',previous:'Previous',next:'Next',event:'Event'},
  de:{title:'Stundenzettel',empty:'Keine Stundenzettel verfügbar.',summary:'Status auf dieser Seite',error:'Stundenzettel konnten nicht geladen werden.',all:'Alle',filter:'Nach Status filtern',total:'Gesamt',page:'Seite',previous:'Zurück',next:'Weiter',event:'Event'}
 } as const)[locale]
 const href=(status:string|null,targetPage:number)=>{
  const query=new URLSearchParams()
  if(eventFilter)query.set('event',eventFilter)
  if(status)query.set('status',status)
  if(targetPage>1)query.set('page',String(targetPage))
  return '/portals/administration/timesheets?'+query.toString()
 }
 let query=access.db.from('timesheets').select('id,event_id,user_id,status,submitted_at,reviewed_at,reviewed_by,rejection_reason',{count:'exact'}).order('updated_at',{ascending:false})
 if(eventFilter)query=query.eq('event_id',eventFilter)
 if(statusFilter)query=query.eq('status',statusFilter)
 const {data,error,count}=await query.range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1)
 const ids=[...new Set((data??[]).map(row=>row.user_id))]
 const eventIds=[...new Set((data??[]).map(row=>row.event_id))]
 const [names,events]=await Promise.all([
  ids.length?access.db.from('profiles').select('id,full_name').in('id',ids):Promise.resolve(null),
  eventIds.length?access.db.from('events').select('id,name').in('id',eventIds):Promise.resolve(null)
 ])
 const eventNames=new Map((events?.data??[]).map(row=>[row.id,row.name]))
 const profileNames=new Map((names?.data??[]).map(row=>[row.id,row.full_name]))
 const statusCounts=(data??[]).reduce<Record<string,number>>((acc,row)=>{acc[row.status]=(acc[row.status]??0)+1;return acc},{})
 const total=count??0
 return <main className="mx-auto max-w-5xl space-y-4 p-5">
  <h1 className="text-2xl font-bold">{t.title}</h1>
  <nav aria-label={t.filter} className="flex flex-wrap gap-2">
   {[null,...STATUSES].map(status=><Link key={status??'all'} href={href(status,1)} aria-current={status===statusFilter?'page':undefined} className={status===statusFilter?'rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white':'rounded-lg border px-3 py-2 text-sm'}>{status?translateRuntimeUi(nlStatus(status),locale):t.all}</Link>)}
  </nav>
  {!error&&<><p className="text-sm text-muted-foreground">{t.total}: {total} · {t.page}: {page}</p><div className="flex flex-wrap gap-2" aria-label={t.summary}>{Object.entries(statusCounts).map(([status,value])=><span key={status} className="rounded-lg border px-3 py-2 text-sm">{translateRuntimeUi(nlStatus(status),locale)}: {value}</span>)}</div></>}
  {error?<p role="alert">{t.error}</p>:!data?.length?<p>{t.empty}</p>:data.map(row=><article key={row.id} className="rounded-xl border p-4">
   <h2 className="font-semibold">{profileNames.get(row.user_id)||row.user_id}</h2>
   <Link href={'/portals/administration/timesheets?event='+encodeURIComponent(row.event_id)} className="text-sm underline underline-offset-2">{t.event}: {eventNames.get(row.event_id)||row.event_id}</Link>
   <p>{translateRuntimeUi(nlStatus(row.status),locale)}</p>
   {row.rejection_reason&&<p>{row.rejection_reason}</p>}
  </article>)}
  {!error&&total>PAGE_SIZE&&<nav className="flex items-center justify-between gap-3" aria-label={t.page}>
   {page>1?<Link href={href(statusFilter,page-1)} className="rounded-lg border px-4 py-2">{t.previous}</Link>:<span/>}
   {page*PAGE_SIZE<total?<Link href={href(statusFilter,page+1)} className="rounded-lg border px-4 py-2">{t.next}</Link>:<span/>}
  </nav>}
 </main>
}
