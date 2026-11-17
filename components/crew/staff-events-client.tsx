"use client"

import {useEffect,useMemo,useState} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {createClient} from "@/lib/supabase/crew-client"
import {boundedQueries} from "@/lib/administration/bounded-queries"
import {setEventAvailability} from "@/lib/actions/uptilldawn"
import {EmergencyInformationPanel} from "@/components/crew/emergency-information-panel"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

type EventRow={id:string;name:string;venue:string|null;address:string|null;start_at:string;end_at:string;registration_deadline:string|null;max_joiners:number|null;status:string}
type Availability={event_id:string;response:string;setup_available:boolean|null;breakdown_available:boolean|null}
type Emergency={event_id:string;emergency_number:string|null;first_aid_contact:string|null;security_contact:string|null;assembly_point:string|null;procedure:string|null;updated_at:string|null}
type Document={id:string;title:string;kind:string;description:string|null;file_name:string;file_size_bytes:number|null;storage_path:string;offline_critical:boolean;audience:string;workplace_id:string|null}
const textCopy={
 nl:{title:"Evenementen",subtitle:"Bekijk evenementen, bevestig je beschikbaarheid en open briefings en documenten.",loading:"Evenementen laden…",retry:"Opnieuw proberen",error:"Evenementen konden niet worden geladen.",none:"Geen evenementen beschikbaar.",unknown:"Locatie nog niet ingesteld",future:"Toekomstig",ongoing:"LOPEND",assigned:"Toegewezen",deadline:"Aanmelddeadline",expired:"Aanmelddeadline verstreken. Je kunt dit evenement nog bekijken, maar niet meer joinen.",capacity:"Maximum aantal bevestigde deelnemers bereikt. Als er een plaats vrijkomt, krijgt de wachtlijst voorrang.",availability:"Beschikbaarheid bevestigen",event:"Evenement",setup:"Opbouw",breakdown:"Afbouw",yes:"Ja",no:"Nee",save:"BESCHIKBAARHEID OPSLAAN",cancel:"IK KAN TOCH NIET",cancelQuestion:"Kun je toch niet meer deelnemen? Afmelden blijft mogelijk na de aanmelddeadline.",cancelReason:"Reden van afmelding",reasonHint:"Geef kort aan waarom je niet meer kunt deelnemen.",briefing:"Briefing",chat:"Chats openen",timesheets:"Werkstaten",command:"COMMAND CENTER",emergency:"Noodinformatie",docs:"Documenten",noDocs:"Geen toegankelijke documenten voor dit evenement.",open:"OPENEN",offline:"OFFLINE BELANGRIJK",scan:"Bijlage wacht op veiligheidscontrole",loadDocs:"Documenten laden…",docError:"Documenten konden niet worden geladen.",recheck:"Vernieuwen",closedChat:"Na afloop blijft de eventchat beschikbaar tot",saveFailed:"Beschikbaarheid kon niet worden opgeslagen.",saving:"Opslaan…"},
 fr:{title:"Événements",subtitle:"Consultez les événements, confirmez vos disponibilités et ouvrez briefings et documents.",loading:"Chargement des événements…",retry:"Réessayer",error:"Impossible de charger les événements.",none:"Aucun événement disponible.",unknown:"Lieu à définir",future:"À venir",ongoing:"EN COURS",assigned:"Affecté",deadline:"Date limite d'inscription",expired:"La date limite est passée. Vous pouvez consulter l'événement, mais plus vous inscrire.",capacity:"Nombre maximum de participants confirmé. La liste d'attente est prioritaire.",availability:"Confirmer les disponibilités",event:"Événement",setup:"Montage",breakdown:"Démontage",yes:"Oui",no:"Non",save:"ENREGISTRER LA DISPONIBILITÉ",cancel:"JE NE PEUX PLUS",cancelQuestion:"Vous ne pouvez plus participer ? Le désistement reste possible.",cancelReason:"Motif du désistement",reasonHint:"Expliquez brièvement votre désistement.",briefing:"Briefing",chat:"Ouvrir les chats",timesheets:"Feuilles de temps",command:"CENTRE DE COMMANDE",emergency:"Informations d'urgence",docs:"Documents",noDocs:"Aucun document accessible pour cet événement.",open:"OUVRIR",offline:"IMPORTANT HORS LIGNE",scan:"Pièce jointe en attente de validation",loadDocs:"Chargement des documents…",docError:"Impossible de charger les documents.",recheck:"Actualiser",closedChat:"Le chat reste disponible jusqu'au",saveFailed:"Impossible d'enregistrer la disponibilité.",saving:"Enregistrement…"},
 en:{title:"Events",subtitle:"See events, confirm availability and open briefings and documents.",loading:"Loading events…",retry:"Try again",error:"Could not load events.",none:"No events available.",unknown:"Venue not set",future:"Upcoming",ongoing:"LIVE",assigned:"Assigned",deadline:"Registration deadline",expired:"Registration deadline has passed. You can still view this event, but cannot join.",capacity:"Maximum confirmed participants reached. The waitlist takes priority.",availability:"Confirm availability",event:"Event",setup:"Setup",breakdown:"Breakdown",yes:"Yes",no:"No",save:"SAVE AVAILABILITY",cancel:"I CANNOT ATTEND",cancelQuestion:"No longer able to attend? You can still cancel after the deadline.",cancelReason:"Cancellation reason",reasonHint:"Briefly explain why you cannot attend.",briefing:"Briefing",chat:"Open chats",timesheets:"Timesheets",command:"COMMAND CENTER",emergency:"Emergency information",docs:"Documents",noDocs:"No accessible documents for this event.",open:"OPEN",offline:"OFFLINE IMPORTANT",scan:"Attachment pending security scan",loadDocs:"Loading documents…",docError:"Could not load documents.",recheck:"Refresh",closedChat:"Event chat stays available until",saveFailed:"Could not save availability.",saving:"Saving…"},
 de:{title:"Veranstaltungen",subtitle:"Veranstaltungen ansehen, Verfügbarkeit bestätigen und Briefings und Dokumente öffnen.",loading:"Veranstaltungen werden geladen…",retry:"Erneut versuchen",error:"Veranstaltungen konnten nicht geladen werden.",none:"Keine Veranstaltungen verfügbar.",unknown:"Ort noch nicht festgelegt",future:"Bevorstehend",ongoing:"LÄUFT",assigned:"Zugewiesen",deadline:"Anmeldefrist",expired:"Die Anmeldefrist ist abgelaufen. Du kannst das Event noch sehen, dich aber nicht mehr anmelden.",capacity:"Maximale Teilnehmerzahl erreicht. Die Warteliste hat Vorrang.",availability:"Verfügbarkeit bestätigen",event:"Veranstaltung",setup:"Aufbau",breakdown:"Abbau",yes:"Ja",no:"Nein",save:"VERFÜGBARKEIT SPEICHERN",cancel:"ICH KANN DOCH NICHT",cancelQuestion:"Du kannst nicht mehr teilnehmen? Eine Absage bleibt möglich.",cancelReason:"Absagegrund",reasonHint:"Erkläre kurz, warum du nicht teilnehmen kannst.",briefing:"Briefing",chat:"Chats öffnen",timesheets:"Stundenzettel",command:"KOMMANDOZENTRALE",emergency:"Notfallinformationen",docs:"Dokumente",noDocs:"Keine zugänglichen Dokumente für diese Veranstaltung.",open:"ÖFFNEN",offline:"OFFLINE WICHTIG",scan:"Anhang wartet auf Sicherheitsprüfung",loadDocs:"Dokumente werden geladen…",docError:"Dokumente konnten nicht geladen werden.",recheck:"Aktualisieren",closedChat:"Eventchat verfügbar bis",saveFailed:"Verfügbarkeit konnte nicht gespeichert werden.",saving:"Speichern…"},
} as const

function EventDocuments({eventId,locale}:{eventId:string;locale:SupportedUiLocale}){
 const db=useMemo(()=>createClient(),[])
 const t=textCopy[locale]
 const [rows,setRows]=useState<Document[]|null>(null)
 const [urls,setUrls]=useState<Record<string,string>>({})
 const [error,setError]=useState(false)
 const [version,setVersion]=useState(0)
 useEffect(()=>{
  let alive=true
  void(async()=>{
   try{
    const result=await db.from("event_documents").select("id,title,kind,description,file_name,file_size_bytes,storage_path,offline_critical,audience,workplace_id").eq("event_id",eventId).eq("is_active",true).order("created_at",{ascending:false}).abortSignal(AbortSignal.timeout(12_000))
    if(result.error)throw result.error
    const data=(result.data??[]) as Document[]
    if(!alive)return
    setRows(data);setError(false)
    const paths=[...new Set(data.map(x=>x.storage_path).filter(Boolean))]
    const signed:Record<string,string>={}
    for(let i=0;i<paths.length;i+=80){
     const response=await db.storage.from("work-media").createSignedUrls(paths.slice(i,i+80),600)
     if(response.error)continue
     for(const item of response.data??[]){
      if(item.path&&item.signedUrl&&paths.includes(item.path))signed[item.path]=item.signedUrl
     }
    }
    if(alive)setUrls(signed)
   }catch{if(alive)setError(true)}
  })()
  return()=>{alive=false}
 },[db,eventId,version])
 return <section className="space-y-3 rounded-xl border p-3">
  <h3 className="font-bold">{t.docs}</h3>
  {rows===null&&!error?<p role="status">{t.loadDocs}</p>:null}
  {error?<p role="alert">{t.docError} <button type="button" className="underline" onClick={()=>{setError(false);setRows(null);setVersion(x=>x+1)}}>{t.retry}</button></p>:null}
  {rows!==null&&!rows.length?<p className="text-sm text-muted-foreground">{t.noDocs}</p>:null}
  {rows?.map(doc=><article key={doc.id} className="rounded-xl border p-3">
   <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
    <p className="font-semibold">{doc.title} · {doc.kind}</p>
    {doc.description?<p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.description}</p>:null}
    <p className="text-xs text-muted-foreground">{doc.file_name} · {doc.file_size_bytes?Math.ceil(doc.file_size_bytes/1024)+" KB":""}</p>
    {doc.offline_critical?<span className="text-xs font-semibold text-amber-500">{t.offline}</span>:null}
   </div>
   {urls[doc.storage_path]?<a href={urls[doc.storage_path]} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">{t.open}</a>:<span role="status" className="text-xs text-muted-foreground">{t.scan}</span>}
   </div>
  </article>)}
 </section>
}

function AvailabilityForm({event,previous,locale,onSaved}:{event:EventRow;previous:Availability|undefined;locale:SupportedUiLocale;onSaved:()=>void}){
 const t=textCopy[locale]
 const [saving,setSaving]=useState(false)
 const [failure,setFailure]=useState(false)
 const registrationDeadline=event.registration_deadline||event.start_at
 const registrationOpen=Date.now()<Date.parse(registrationDeadline)
 const canCancel=Date.now()<Date.parse(event.end_at)&&previous?.response==="can"
 const submit=async(fd:FormData)=>{
  if(saving)return
  setSaving(true);setFailure(false)
  try{await setEventAvailability(fd);onSaved()}catch{setFailure(true)}finally{setSaving(false)}
 }
 return <section className="space-y-3">
  <p className="text-sm">{t.deadline}: {new Date(registrationDeadline).toLocaleString(locale==="nl"?"nl-BE":locale)}</p>
  {registrationOpen?<form action={submit} className="grid gap-3 rounded-xl border p-3 md:grid-cols-3">
   <input type="hidden" name="event_id" value={event.id}/>
   {([
    ["response",t.event,previous?.response==="can",previous?.response==="cannot","can","cannot"],
    ["setup_available",t.setup,previous?.setup_available===true,previous?.setup_available===false,"yes","no"],
    ["breakdown_available",t.breakdown,previous?.breakdown_available===true,previous?.breakdown_available===false,"yes","no"],
   ] as const).map(([name,label,yes,no,yesValue,noValue])=><fieldset key={name} className="space-y-2">
    <legend className="text-sm font-semibold">{label}</legend>
    <label className="flex gap-2"><input required type="radio" name={name} value={yesValue} defaultChecked={yes}/>{t.yes}</label>
    <label className="flex gap-2"><input required type="radio" name={name} value={noValue} defaultChecked={no}/>{t.no}</label>
   </fieldset>)}
   <button disabled={saving} className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-3">{saving?t.saving:t.save}</button>
  </form>:<p className="text-sm text-amber-500">{t.expired}</p>}
  {!registrationOpen&&canCancel?<form action={submit} className="space-y-2 rounded-xl border p-3">
    <input type="hidden" name="event_id" value={event.id}/>
    <input type="hidden" name="response" value="cannot"/>
    <input type="hidden" name="setup_available" value="no"/>
    <input type="hidden" name="breakdown_available" value="no"/>
    <p className="text-sm">{t.cancelQuestion}</p>
    <label className="grid gap-2 text-sm">{t.cancelReason}<textarea name="reason" minLength={3} maxLength={1000} required placeholder={t.reasonHint} className="rounded-lg border bg-background p-3"/></label>
    <button disabled={saving} className="rounded-lg border border-red-500/60 px-4 py-3 font-bold">{t.cancel}</button>
  </form>:null}
  {failure?<p role="alert" className="text-red-500">{t.saveFailed}</p>:null}
 </section>
}

export function StaffEventsClient({userId,focusEvent}:{userId:string;focusEvent?:string}){
 const db=useMemo(()=>createClient(),[])
 const router=useRouter()
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [events,setEvents]=useState<EventRow[]>([])
 const [assigned,setAssigned]=useState<Set<string>>(new Set())
 const [availability,setAvailability]=useState<Availability[]>([])
 const [emergency,setEmergency]=useState<Emergency[]>([])
 const [counts,setCounts]=useState<Map<string,number>>(new Map())
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [revision,setRevision]=useState(0)
 const [expanded,setExpanded]=useState<Set<string>>(new Set())
 useEffect(()=>{const update=()=>setLocale(activeUiLocale());update();window.addEventListener(LANGUAGE_APPLIED_EVENT,update);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,update)},[])
 useEffect(()=>{
  let alive=true
  void(async()=>{
   try{
    const signal=AbortSignal.timeout(14_000)
    // These remain per-user RLS-protected requests: no elevated API keys and
    // no route-specific Worker SSR, only the verified server layout.
    const [ev,mem,sh,avail,info]=await boundedQueries([
     db.from("events").select("id,name,venue,address,start_at,end_at,registration_deadline,max_joiners,status").order("start_at").abortSignal(signal),
     db.from("event_members").select("event_id,user_id").abortSignal(signal),
     db.from("shifts").select("event_id").eq("user_id",userId).neq("status","cancelled").neq("response_status","declined").abortSignal(signal),
     db.from("event_availability").select("event_id,response,setup_available,breakdown_available").eq("user_id",userId).abortSignal(signal),
     db.from("event_emergency_information").select("event_id,emergency_number,first_aid_contact,security_contact,assembly_point,procedure,updated_at").abortSignal(signal),
    ],2)
    if(ev.error||mem.error||sh.error||avail.error||info.error)throw Error("RLS events unavailable")
    if(!alive)return
    const m=new Set([...(mem.data??[]).filter(x=>x.user_id===userId).map(x=>x.event_id),...(sh.data??[]).map(x=>x.event_id)])
    const n=Date.now()
    setEvents((ev.data??[]).filter(e=>e.status!=="archived"&&(Date.parse(e.end_at)>=n||(m.has(e.id)&&n<=Date.parse(e.end_at)+3*86400_000))))
    setAssigned(m)
    const all=new Map<string,number>()
    for(const row of mem.data??[])all.set(row.event_id,(all.get(row.event_id)||0)+1)
    setCounts(all)
    setAvailability(avail.data??[]);setEmergency(info.data??[])
    setLoading(false);setError(false)
   }catch{if(alive){setError(true);setLoading(false)}}
  })()
  return()=>{alive=false}
 },[db,userId,revision])
 const t=textCopy[locale]
 const sorted=useMemo(()=>[...events].sort((a,b)=>Number(b.id===focusEvent)-Number(a.id===focusEvent)||Date.parse(a.start_at)-Date.parse(b.start_at)),[events,focusEvent])
 const date=(iso:string)=>new Date(iso).toLocaleString(locale==="nl"?"nl-BE":locale)
 return <main id="eventbeheer" className="space-y-5 p-4 pb-24 md:p-8">
  <header><h1 className="text-3xl font-black">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p></header>
  {loading?<p role="status">{t.loading}</p>:null}
  {error?<p role="alert">{t.error} <button type="button" className="underline" onClick={()=>{setLoading(true);setError(false);setRevision(x=>x+1)}}>{t.retry}</button></p>:null}
  {!loading&&!error&&!sorted.length?<p>{t.none}</p>:null}
  {sorted.map(event=>{
   const assignedToEvent=assigned.has(event.id)
   const started=Date.now()>=Date.parse(event.start_at)
   const ended=Date.now()>Date.parse(event.end_at)
   const isExpanded=expanded.has(event.id)||event.id===focusEvent
   const info=emergency.find(x=>x.event_id===event.id)
   return <details key={event.id} open={isExpanded} onToggle={e=>{
      const open=e.currentTarget.open
      if(open!==isExpanded)setExpanded(prev=>{const next=new Set(prev);if(open)next.add(event.id);else next.delete(event.id);return next})
     }} className="rounded-2xl border bg-card">
    <summary className="cursor-pointer p-4"><span className="text-lg font-semibold">{event.name}</span><span className="ml-2 text-xs text-muted-foreground">{started&&!ended?t.ongoing:!started?t.future:""}</span>
     <p className="text-sm text-muted-foreground">{event.venue||t.unknown} · {date(event.start_at)}</p>
     {event.address?<p className="text-xs text-muted-foreground">{event.address}</p>:null}
     {event.max_joiners!==null?<p className="text-xs">{counts.get(event.id)||0}/{event.max_joiners}</p>:null}
     {assignedToEvent?<span className="text-xs font-semibold">{t.assigned}</span>:null}
    </summary>
    {isExpanded?<div className="space-y-4 border-t p-4">
     <nav className="flex flex-wrap gap-2">
      <Link prefetch={false} href={"/events/"+event.id+"/command"} className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white">{t.command}</Link>
      <Link prefetch={false} href={"/timesheets?event="+encodeURIComponent(event.id)} className="rounded-lg border px-3 py-2">{t.timesheets}</Link>
      {assignedToEvent?<Link prefetch={false} href={"/briefings?event="+encodeURIComponent(event.id)} className="rounded-lg border px-3 py-2">{t.briefing}</Link>:null}
     </nav>
     <EmergencyInformationPanel compact canEdit={false} info={{
       eventId:event.id,eventName:event.name,eventAddress:event.address||"",
       emergencyNumber:info?.emergency_number||"",firstAidContact:info?.first_aid_contact||null,
       securityContact:info?.security_contact||null,assemblyPoint:info?.assembly_point||null,
       procedure:info?.procedure||null,updatedAt:info?.updated_at||null,
     }}/>
     <EventDocuments eventId={event.id} locale={locale}/>
     <AvailabilityForm key={event.id+revision} event={event}
       previous={availability.find(a=>a.event_id===event.id)} locale={locale}
       onSaved={()=>{setRevision(n=>n+1);router.refresh()}}/>
     {!ended&&event.max_joiners!==null&&(counts.get(event.id)||0)>=event.max_joiners?<p className="text-sm text-amber-500">{t.capacity}</p>:null}
     {started&&assignedToEvent?<p className="text-sm">{t.closedChat} {date(new Date(Date.parse(event.end_at)+3*86400_000).toISOString())}. <Link prefetch={false} href="/chat" className="underline">{t.chat}</Link></p>:null}
    </div>:null}
   </details>
  })}
 </main>
}
