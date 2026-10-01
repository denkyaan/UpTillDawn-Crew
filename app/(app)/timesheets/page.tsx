import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/crew-server'
import {getCurrentUser} from '@/lib/actions/auth'
import {requestUiLocale} from '@/lib/server-locale'
import TimesheetControls from '@/components/crew/timesheet-controls'
export const dynamic='force-dynamic'
const COPY={
 nl:{title:'Werkstaten',mine:'Mijn werkstaat',team:'Werkstaten team',submit:'INDIENEN',resubmit:'OPNIEUW INDIENEN',approve:'GOEDKEUREN',reject:'AFWIJZEN',lock:'VERGRENDELEN',reason:'Reden van afwijzing',empty:'Geen werkstaten beschikbaar.',working:'Bezig…'},
 fr:{title:'Feuilles de temps',mine:'Ma feuille de temps',team:"Feuilles de temps de l'équipe",submit:'SOUMETTRE',resubmit:'SOUMETTRE À NOUVEAU',approve:'APPROUVER',reject:'REFUSER',lock:'VERROUILLER',reason:'Motif du refus',empty:'Aucune feuille de temps disponible.',working:'Traitement…'},
 en:{title:'Timesheets',mine:'My timesheet',team:'Team timesheets',submit:'SUBMIT',resubmit:'RESUBMIT',approve:'APPROVE',reject:'REJECT',lock:'LOCK',reason:'Rejection reason',empty:'No timesheets available.',working:'Working…'},
 de:{title:'Stundenzettel',mine:'Mein Stundenzettel',team:'Team-Stundenzettel',submit:'EINREICHEN',resubmit:'ERNEUT EINREICHEN',approve:'GENEHMIGEN',reject:'ABLEHNEN',lock:'SPERREN',reason:'Ablehnungsgrund',empty:'Keine Stundenzettel verfügbar.',working:'Wird verarbeitet…'}
} as const
export default async function Page({searchParams}:{searchParams?:Promise<{event?:string}>}){
 const params=searchParams?await searchParams:{};const current=await getCurrentUser();if(!current)redirect('/login')
 const s=await createClient();const locale=await requestUiLocale();const copy=COPY[locale];const isAdmin=current.role==='admin';const isResponsible=current.role==='responsible_lead'
 let eventId=params.event
 if(!eventId){const {data}=await s.from('event_members').select('event_id').eq('user_id',current.id).limit(1).maybeSingle();eventId=data?.event_id}
 if(!eventId)return <main className="p-8"><h1 className="text-3xl font-black">{copy.title}</h1><p className="mt-4">{copy.empty}</p></main>
 const {data:rows,error}=await s.from('timesheets').select('id,event_id,user_id,status,rejection_reason').eq('event_id',eventId).order('updated_at',{ascending:false})
 if(error)return <main className="p-8">{copy.empty}</main>
 const own=(rows||[]).find(r=>r.user_id===current.id)||null
 return <main className="space-y-6 p-4 pb-28 md:p-8"><h1 className="text-3xl font-black">{copy.title}</h1><TimesheetControls eventId={eventId} userId={current.id} isAdmin={isAdmin} isResponsible={isResponsible} own={own} rows={rows||[]} copy={copy}/></main>
}
