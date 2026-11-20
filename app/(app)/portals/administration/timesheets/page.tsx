import Link from 'next/link'
import {redirect} from 'next/navigation'
import TimesheetsPage from '@/app/(app)/timesheets/page'
import {administrationAccess} from '@/lib/administration/access'
import {
 ADMINISTRATION_TIMESHEET_PAGE_SIZE,
 ADMINISTRATION_TIMESHEET_STATUSES,
 administrationTimesheetHref,
 parseAdministrationTimesheetFilters,
 type AdministrationTimesheetStatus,
} from '@/lib/administration/timesheet-filters'
import {requestUiLocale} from '@/lib/server-locale'
import {translateRuntimeUi} from '@/lib/ui-translation-runtime'
import {nlStatus} from '@/lib/ui-nl'

export const dynamic='force-dynamic'

type Search={event?:string;user?:string;status?:string;page?:string;mode?:string}

export default async function AdministrationTimesheets({searchParams}:{searchParams:Promise<Search>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 const params=await searchParams
 const {eventFilter,userFilter,statusFilter,page}=parseAdministrationTimesheetFilters(params)
 const canReview=Boolean(access.user.realIsAdmin||access.user.isOwner)
 const locale=await requestUiLocale()
 const t=({
  nl:{title:'Werkstaten',empty:'Geen werkstaten beschikbaar.',summary:'Werkstaatstatussen op deze pagina',error:'Werkstaten konden niet worden geladen.',all:'Alle',filter:'Status filteren',total:'Totaal',page:'Pagina',previous:'Vorige',next:'Volgende',event:'Evenement',staff:'Medewerker',clearEvent:'Eventfilter wissen',clearStaff:'Medewerkerfilter wissen',clearAll:'Alle filters wissen',review:'Werkstaat beoordelen',back:'Terug naar werkstatenoverzicht',payroll:'Goedgekeurde uren exporteren (CSV)',noPayroll:'Voor dit evenement zijn nog geen goedgekeurde of vergrendelde werkstaten.',payrollError:'De exportstatus kon niet worden gecontroleerd.',submitted:'Ingediend op',reviewed:'Beoordeeld op'},
  fr:{title:'Feuilles de temps',empty:'Aucune feuille disponible.',summary:'Statuts sur cette page',error:'Impossible de charger les feuilles de temps.',all:'Tous',filter:'Filtrer par statut',total:'Total',page:'Page',previous:'Précédent',next:'Suivant',event:'Événement',staff:'Membre du personnel',clearEvent:'Effacer le filtre événement',clearStaff:'Effacer le filtre personnel',clearAll:'Effacer tous les filtres',review:'Examiner la feuille de temps',back:'Retour à la liste des feuilles de temps',payroll:'Exporter les heures approuvées (CSV)',noPayroll:'Aucune feuille approuvée ou verrouillée pour cet événement.',payrollError:'Impossible de vérifier la disponibilité de l’export.',submitted:'Soumis le',reviewed:'Examiné le'},
  en:{title:'Timesheets',empty:'No timesheets available.',summary:'Statuses on this page',error:'Unable to load timesheets.',all:'All',filter:'Filter by status',total:'Total',page:'Page',previous:'Previous',next:'Next',event:'Event',staff:'Staff member',clearEvent:'Clear event filter',clearStaff:'Clear staff filter',clearAll:'Clear all filters',review:'Review timesheet',back:'Back to timesheet overview',payroll:'Export approved hours (CSV)',noPayroll:'No approved or locked timesheets for this event yet.',payrollError:'Unable to check export availability.',submitted:'Submitted on',reviewed:'Reviewed on'},
  de:{title:'Stundenzettel',empty:'Keine Stundenzettel verfügbar.',summary:'Status auf dieser Seite',error:'Stundenzettel konnten nicht geladen werden.',all:'Alle',filter:'Nach Status filtern',total:'Gesamt',page:'Seite',previous:'Zurück',next:'Weiter',event:'Event',staff:'Mitarbeiter',clearEvent:'Eventfilter löschen',clearStaff:'Mitarbeiterfilter löschen',clearAll:'Alle Filter löschen',review:'Stundenzettel prüfen',back:'Zurück zur Stundenzettelübersicht',payroll:'Genehmigte Stunden exportieren (CSV)',noPayroll:'Für dieses Event liegen noch keine genehmigten oder gesperrten Stundenzettel vor.',payrollError:'Exportverfügbarkeit konnte nicht geprüft werden.',submitted:'Eingereicht am',reviewed:'Geprüft am'}
 } as const)[locale]
 const href=(status:AdministrationTimesheetStatus|null,targetPage:number,eventId=eventFilter,userId=userFilter)=>
  administrationTimesheetHref(status,targetPage,eventId,userId)

 // An Admin can enter the existing submit/review/lock workflow without leaving
 // the Administration portal; ordinary Administration users remain read-only.
 if(canReview&&params.mode==='review'){
  return <div className="space-y-3">
   <div className="mx-auto max-w-5xl px-5 pt-5">
    <Link href={href(null,1,eventFilter,null)} className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold">{t.back}</Link>
   </div>
   {await TimesheetsPage({searchParams,navigationBasePath:'/portals/administration/timesheets',reviewMode:true})}
  </div>
 }

 let query=access.db.from('timesheets')
  .select('id,event_id,user_id,status,submitted_at,reviewed_at,reviewed_by,rejection_reason',{count:'exact'})
  .order('updated_at',{ascending:false}).order('id',{ascending:false})
 if(eventFilter)query=query.eq('event_id',eventFilter)
 if(userFilter)query=query.eq('user_id',userFilter)
 if(statusFilter)query=query.eq('status',statusFilter)
 const {data,error,count}=await query.range((page-1)*ADMINISTRATION_TIMESHEET_PAGE_SIZE,page*ADMINISTRATION_TIMESHEET_PAGE_SIZE-1)
 // Handle deleted/filtered records and empty sets without leaving users on an invalid page.
 if(!error&&count!==null&&page>1&&(page-1)*ADMINISTRATION_TIMESHEET_PAGE_SIZE>=count)
  redirect(href(statusFilter,Math.max(1,Math.ceil(count/ADMINISTRATION_TIMESHEET_PAGE_SIZE))))

 const [labelResult,payrollResult]=await Promise.all([
  !error&&data?.length
   ?access.db.rpc('upt_administration_timesheet_labels',{p_timesheet_ids:data.map(row=>row.id)})
   :Promise.resolve(null),
  !error&&eventFilter
   ?access.db.from('timesheets').select('id',{head:true,count:'exact'}).eq('event_id',eventFilter).in('status',['approved','locked'])
   :Promise.resolve(null),
 ])
 const labels=labelResult?.data??[]
 const labelsError=labelResult?.error
 const eventNames=new Map(labels.map(row=>[row.event_id,row.event_name]))
 const profileNames=new Map(labels.map(row=>[row.user_id,row.crew_name]))
 const statusCounts=(data??[]).reduce<Record<string,number>>((acc,row)=>{acc[row.status]=(acc[row.status]??0)+1;return acc},{})
 const total=count??0
 const payrollAvailable=Boolean(payrollResult&&!payrollResult.error&&(payrollResult.count??0)>0)
 const dateLocale=({nl:'nl-BE',fr:'fr-BE',en:'en-GB',de:'de-DE'} as const)[locale]
 const formatDate=(value:string)=>new Date(value).toLocaleString(dateLocale,{timeZone:'Europe/Brussels'})

 return <main className="mx-auto max-w-5xl space-y-4 p-5 pb-28">
  <h1 className="text-2xl font-bold">{t.title}</h1>
  <nav aria-label={t.filter} className="flex flex-wrap gap-2">
   {[null,...ADMINISTRATION_TIMESHEET_STATUSES].map(status=><Link key={status??'all'} href={href(status,1)} aria-current={status===statusFilter?'page':undefined} className={status===statusFilter?'rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white':'rounded-lg border px-3 py-2 text-sm'}>{status?translateRuntimeUi(nlStatus(status),locale):t.all}</Link>)}
  </nav>
  {(eventFilter||userFilter)&&<nav aria-label={t.clearAll} className="flex flex-wrap items-center gap-2">
   {eventFilter&&<Link href={href(statusFilter,1,null,userFilter)} className="rounded-lg border px-3 py-2 text-sm">{t.clearEvent}: {eventNames.get(eventFilter)||eventFilter}</Link>}
   {userFilter&&<Link href={href(statusFilter,1,eventFilter,null)} className="rounded-lg border px-3 py-2 text-sm">{t.clearStaff}: {profileNames.get(userFilter)||userFilter}</Link>}
   <Link href={href(null,1,null,null)} className="rounded-lg border px-3 py-2 text-sm">{t.clearAll}</Link>
  </nav>}
  {eventFilter&&!error&&<section className="rounded-xl border p-3">
   {payrollResult?.error?<p role="alert">{t.payrollError}</p>:payrollAvailable
    ?<a href={'/api/administration/payroll/export?event='+encodeURIComponent(eventFilter)} className="inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">{t.payroll}</a>
    :<p className="text-sm text-muted-foreground">{t.noPayroll}</p>}
  </section>}
  {!error&&!labelsError&&<><p className="text-sm text-muted-foreground">{t.total}: {total} · {t.page}: {page}</p>
   <div className="flex flex-wrap gap-2" aria-label={t.summary}>{Object.entries(statusCounts).map(([status,value])=><span key={status} className="rounded-lg border px-3 py-2 text-sm">{translateRuntimeUi(nlStatus(status),locale)}: {value}</span>)}</div></>}
  {error||labelsError?<p role="alert">{t.error}</p>:!data?.length?<p>{t.empty}</p>:data.map(row=><article key={row.id} className="space-y-2 rounded-xl border p-4">
   <h2 className="font-semibold"><Link href={href(statusFilter,1,eventFilter,row.user_id)} className="underline underline-offset-2">{profileNames.get(row.user_id)||row.user_id}</Link></h2>
   <Link href={href(statusFilter,1,row.event_id,userFilter)} className="text-sm underline underline-offset-2">{t.event}: {eventNames.get(row.event_id)||row.event_id}</Link>
   <p>{translateRuntimeUi(nlStatus(row.status),locale)}</p>
   {row.submitted_at&&<p className="text-xs text-muted-foreground">{t.submitted}: {formatDate(row.submitted_at)}</p>}
   {row.reviewed_at&&<p className="text-xs text-muted-foreground">{t.reviewed}: {formatDate(row.reviewed_at)}</p>}
   {row.rejection_reason&&<p className="text-sm">{row.rejection_reason}</p>}
   {canReview&&<Link href={'/portals/administration/timesheets?mode=review&event='+encodeURIComponent(row.event_id)} className="inline-block rounded-lg border px-3 py-2 text-sm font-semibold">{t.review}</Link>}
  </article>)}
  {!error&&!labelsError&&total>ADMINISTRATION_TIMESHEET_PAGE_SIZE&&<nav className="flex items-center justify-between gap-3" aria-label={t.page}>
   {page>1?<Link href={href(statusFilter,page-1)} className="rounded-lg border px-4 py-2">{t.previous}</Link>:<span/>}
   {page*ADMINISTRATION_TIMESHEET_PAGE_SIZE<total?<Link href={href(statusFilter,page+1)} className="rounded-lg border px-4 py-2">{t.next}</Link>:<span/>}
  </nav>}
 </main>
}
