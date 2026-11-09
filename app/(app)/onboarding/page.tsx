import Link from 'next/link'
import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {requestUiLocale} from '@/lib/server-locale'
import {completeEventOnboardingStep} from '@/lib/actions/onboarding'

export const dynamic='force-dynamic'

const stepKeys=['briefing','safety','map','workplace','responsible','inventory'] as const
const translations={
 nl:{heading:'Eventvoorbereiding',intro:'Bevestig de verplichte praktische voorbereiding vóór je shift.',none:'Je hebt nog geen toegewezen evenement.',empty:'Geen actief evenement voor je voorbereiding.',error:'Voorbereiding kon niet worden geladen. Probeer opnieuw.',noStatus:'Je voortgang is tijdelijk niet beschikbaar. Er kunnen geen stappen worden bevestigd.',optional:'Voorbereiding is voor dit evenement niet verplicht.',completed:'Afgerond',pending:'Nog te bevestigen',ready:'GEREED',confirm:'BEVESTIG',finish:'VOORBEREIDING AFRONDEN',finishDesc:'Bevestig de volledige voorbereiding nadat alle stappen afgerond zijn.',readyTitle:'Klaar voor het evenement',readyDesc:'Alle vereiste voorbereidingsstappen zijn bevestigd.',events:'Mijn evenementen',briefing:'Briefing bevestigd',safety:'Veiligheidsregels gelezen',map:'Eventkaart bekeken',workplace:'Werkplek bekeken',responsible:'Verantwoordelijke gekend',inventory:'Materiaal en inventaris bekeken',back:'Terug naar evenementen'},
 fr:{heading:'Préparation de l’événement',intro:'Confirmez les préparatifs nécessaires avant votre service.',none:'Aucun événement ne vous est attribué.',empty:'Aucun événement actif pour la préparation.',error:'Impossible de charger la préparation. Réessayez.',noStatus:'Votre progression est indisponible. Les étapes ne peuvent pas être validées.',optional:'La préparation n’est pas obligatoire pour cet événement.',completed:'Terminé',pending:'À confirmer',ready:'PRÊT',confirm:'CONFIRMER',finish:'TERMINER LA PRÉPARATION',finishDesc:'Confirmez la préparation après avoir validé chaque étape.',readyTitle:'Prêt pour l’événement',readyDesc:'Toutes les étapes obligatoires sont confirmées.',events:'Mes événements',briefing:'Briefing confirmé',safety:'Consignes de sécurité lues',map:'Plan de l’événement consulté',workplace:'Poste de travail consulté',responsible:'Responsable identifié',inventory:'Matériel et inventaire consultés',back:'Retour aux événements'},
 en:{heading:'Event preparation',intro:'Confirm the required operational steps before your shift.',none:'You have no assigned events yet.',empty:'No active event is available for preparation.',error:'Event preparation could not be loaded. Try again.',noStatus:'Progress is temporarily unavailable. No steps can be confirmed.',optional:'Preparation is not required for this event.',completed:'Completed',pending:'Not yet confirmed',ready:'READY',confirm:'CONFIRM',finish:'COMPLETE PREPARATION',finishDesc:'Confirm the full preparation once every step is complete.',readyTitle:'Ready for the event',readyDesc:'All required preparation steps have been confirmed.',events:'My events',briefing:'Briefing acknowledged',safety:'Safety rules reviewed',map:'Event map reviewed',workplace:'Workplace reviewed',responsible:'Responsible lead identified',inventory:'Materials and inventory reviewed',back:'Back to events'},
 de:{heading:'Eventvorbereitung',intro:'Bestätige die erforderlichen Vorbereitungen vor Schichtbeginn.',none:'Dir ist noch keine Veranstaltung zugewiesen.',empty:'Keine aktive Veranstaltung zur Vorbereitung verfügbar.',error:'Die Vorbereitung konnte nicht geladen werden. Bitte erneut versuchen.',noStatus:'Dein Fortschritt ist vorübergehend nicht verfügbar. Schritte können nicht bestätigt werden.',optional:'Für diese Veranstaltung ist keine Vorbereitung vorgeschrieben.',completed:'Abgeschlossen',pending:'Noch zu bestätigen',ready:'BEREIT',confirm:'BESTÄTIGEN',finish:'VORBEREITUNG ABSCHLIESSEN',finishDesc:'Bestätige die gesamte Vorbereitung, nachdem alle Schritte erledigt sind.',readyTitle:'Bereit für die Veranstaltung',readyDesc:'Alle erforderlichen Vorbereitungsschritte sind bestätigt.',events:'Meine Veranstaltungen',briefing:'Briefing bestätigt',safety:'Sicherheitsregeln gelesen',map:'Eventplan angesehen',workplace:'Arbeitsplatz angesehen',responsible:'Verantwortliche Person bekannt',inventory:'Material und Inventar angesehen',back:'Zurück zu Veranstaltungen'},
} as const

export default async function OnboardingPage({searchParams}:{searchParams:Promise<{event?:string}>}){
 const current=await getCurrentUser()
 if(!current)redirect('/login')
 if((!current.approved||current.account_blocked)&&!current.isOwner)redirect('/portals')
 const locale=await requestUiLocale()
 const t=translations[locale]
 const db=await createClient()
 const params=await searchParams
 const [{data:members,error:memberError},{data:shifts,error:shiftError}]=await Promise.all([
  db.from('event_members').select('event_id').eq('user_id',current.id),
  db.from('shifts').select('event_id').eq('user_id',current.id).neq('status','cancelled').neq('response_status','declined'),
 ])
 const shell=(message:string)=> <main className="mx-auto max-w-3xl space-y-4 p-4 pb-28 md:p-8">
  <Link href="/events" className="text-sm font-semibold text-violet-400">{t.back}</Link>
  <h1 className="text-3xl font-bold">{t.heading}</h1>
  <p role={memberError||shiftError?'alert':'status'} className="rounded-xl border p-4 text-muted-foreground">{message}</p>
 </main>
 if(memberError||shiftError)return shell(t.error)
 const eventIds=[...new Set([...(members??[]).map(item=>item.event_id),...(shifts??[]).map(item=>item.event_id)])]
 if(!eventIds.length)return shell(t.none)
 const {data:events,error:eventError}=await db.from('events')
  .select('id,name,start_at,end_at,status,onboarding_required')
  .in('id',eventIds).neq('status','archived').order('start_at')
 if(eventError)return shell(t.error)
 const selected=(events??[]).find(event=>event.id===params.event)||(events??[])[0]
 if(!selected)return shell(t.empty)
 const result=selected.onboarding_required
  ?await db.rpc('upt_event_onboarding_status',{p_event:selected.id})
  :null
 const status=result?.data
 const statusUnavailable=Boolean(selected.onboarding_required)&&
  (Boolean(result?.error)||!status||typeof status!=='object'||Array.isArray(status))
 const data=(!statusUnavailable&&status&&typeof status==='object'&&!Array.isArray(status)
  ?status:{} ) as {completed?:unknown;ready?:unknown}
 const completed=new Set(Array.isArray(data.completed)
  ?data.completed.filter((value):value is string=>typeof value==='string'&&stepKeys.some(step=>step===value))
  :[])
 const ready=data.ready===true
 const dateLocale=({nl:'nl-BE',fr:'fr-BE',en:'en-GB',de:'de-DE'} as const)[locale]
 return <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 md:p-8">
  <div>
   <Link href="/events" className="text-sm font-semibold text-violet-400">{t.back}</Link>
   <h1 className="mt-3 text-3xl font-bold">{t.heading}</h1>
   <p className="text-sm text-muted-foreground">{t.intro}</p>
  </div>
  <nav aria-label={t.events} className="flex flex-wrap gap-2">
   {(events??[]).map(event=><Link key={event.id} href={'/onboarding?event='+encodeURIComponent(event.id)}
    aria-current={event.id===selected.id?'page':undefined}
    className={'rounded-xl border px-3 py-2 text-sm font-bold '+(event.id===selected.id?'bg-violet-600 text-white':'')}>
    {event.name}
   </Link>)}
  </nav>
  <section className="rounded-2xl border p-4">
   <h2 className="text-xl font-bold">{selected.name}</h2>
   <p className="text-sm text-muted-foreground">
    {new Intl.DateTimeFormat(dateLocale,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'})
     .format(new Date(selected.start_at))}
   </p>
  </section>
  {!selected.onboarding_required&&<p role="status" className="rounded-xl border border-emerald-500/40 p-4">{t.optional}</p>}
  {statusUnavailable&&<p role="alert" className="rounded-xl border border-amber-500/50 p-4">{t.noStatus}</p>}
  {selected.onboarding_required&&!statusUnavailable&&<>
   <section className="space-y-2">{stepKeys.map(key=>{
    const done=completed.has(key)
    return <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
     <div><b>{t[key]}</b><p className="text-xs text-muted-foreground">{done?t.completed:t.pending}</p></div>
     {done?<span className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs font-bold text-emerald-600">{t.ready}</span>:
      <form action={completeEventOnboardingStep}>
       <input type="hidden" name="event_id" value={selected.id}/>
       <input type="hidden" name="step" value={key}/>
       <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white">{t.confirm}</button>
      </form>}
    </div>
   })}</section>
   <section className="rounded-2xl border p-4">
    {ready?<div><h2 className="text-xl font-bold text-emerald-600">{t.readyTitle}</h2>
     <p className="text-sm text-muted-foreground">{t.readyDesc}</p></div>:
     <form action={completeEventOnboardingStep} className="space-y-2">
      <input type="hidden" name="event_id" value={selected.id}/>
      <input type="hidden" name="step" value="confirmed"/>
      <p className="text-sm text-muted-foreground">{t.finishDesc}</p>
      <button type="submit" disabled={completed.size!==stepKeys.length}
       className="w-full rounded-xl bg-emerald-700 p-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{t.finish}</button>
     </form>}
   </section>
  </>}
 </main>
}
