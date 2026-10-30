import {redirect} from 'next/navigation'
import TimesheetsPage from '@/app/(app)/timesheets/page'
import {administrationAccess} from '@/lib/administration/access'
import {requestUiLocale} from '@/lib/server-locale'
import {translateRuntimeUi} from '@/lib/ui-translation-runtime'
import {nlStatus} from '@/lib/ui-nl'

export const dynamic='force-dynamic'

export default async function AdministrationTimesheets({searchParams}:{searchParams:Promise<{event?:string}>}){
 const access=await administrationAccess()
 if(!access.ok)redirect('/portals')
 if(access.user.realIsAdmin)return TimesheetsPage({searchParams})
 const {event}=await searchParams
 const locale=await requestUiLocale()
 const t=({nl:{title:'Werkstaten',empty:'Geen werkstaten beschikbaar.',error:'Werkstaten konden niet worden geladen.'},fr:{title:'Feuilles de temps',empty:'Aucune feuille disponible.',error:'Impossible de charger les feuilles de temps.'},en:{title:'Timesheets',empty:'No timesheets available.',error:'Unable to load timesheets.'},de:{title:'Stundenzettel',empty:'Keine Stundenzettel verfügbar.',error:'Stundenzettel konnten nicht geladen werden.'}} as const)[locale]
 let query=access.db.from('timesheets').select('id,user_id,status,submitted_at,rejection_reason').order('updated_at',{ascending:false}).limit(100)
 if(event&&/^[0-9a-f-]{36}$/i.test(event))query=query.eq('event_id',event)
 const {data,error}=await query
 const ids=[...new Set((data??[]).map(row=>row.user_id))]
 const names=ids.length?await access.db.from('profiles').select('id,full_name').in('id',ids):null
 return <main className="mx-auto max-w-5xl space-y-4 p-5"><h1 className="text-2xl font-bold">{t.title}</h1>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p>{t.empty}</p>:data.map(row=><article key={row.id} className="rounded-xl border p-4"><h2 className="font-semibold">{names?.data?.find(profile=>profile.id===row.user_id)?.full_name??row.user_id}</h2><p>{translateRuntimeUi(nlStatus(row.status),locale)}</p>{row.rejection_reason&&<p>{row.rejection_reason}</p>}</article>)}
 </main>
}
