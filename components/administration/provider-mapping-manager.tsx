"use client"
import {useEffect,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
type Mapping={id:string;provider:"eventix"|"sumup";external_event_id:string;event_id:string;enabled:boolean}
type EventChoice={id:string;name:string}
const copy={
 nl:{title:"Eventix / SumUp evenementkoppelingen",event:"Evenement",external:"Extern evenement-ID",provider:"Provider",add:"Koppeling toevoegen",enable:"Activeren",disable:"Uitschakelen",empty:"Geen koppelingen",loading:"Koppelingen laden…",error:"Bewerking mislukt. Controleer je rechten en de database.",notice:"Een actieve koppeling start nog geen automatische synchronisatie."},
 fr:{title:"Associations d’événements Eventix / SumUp",event:"Événement",external:"ID événement externe",provider:"Fournisseur",add:"Ajouter l’association",enable:"Activer",disable:"Désactiver",empty:"Aucune association",loading:"Chargement…",error:"Échec de l’opération. Vérifiez vos droits et la base de données.",notice:"Une association active ne lance pas encore la synchronisation automatique."},
 en:{title:"Eventix / SumUp event mappings",event:"Event",external:"External event ID",provider:"Provider",add:"Add mapping",enable:"Enable",disable:"Disable",empty:"No mappings",loading:"Loading mappings…",error:"Operation failed. Check your permissions and database.",notice:"Enabling a mapping does not start automatic synchronization yet."},
 de:{title:"Eventix / SumUp Ereigniszuordnungen",event:"Ereignis",external:"Externe Ereignis-ID",provider:"Anbieter",add:"Zuordnung hinzufügen",enable:"Aktivieren",disable:"Deaktivieren",empty:"Keine Zuordnungen",loading:"Zuordnungen laden…",error:"Vorgang fehlgeschlagen. Prüfen Sie Rechte und Datenbank.",notice:"Eine aktive Zuordnung startet noch keine automatische Synchronisierung."}
} as const
export default function ProviderMappingManager({locale,events}:{locale:SupportedUiLocale;events:EventChoice[]}){
 const t=copy[locale], [mappings,setMappings]=useState<Mapping[]>([]),[provider,setProvider]=useState<"eventix"|"sumup">("eventix"),[eventId,setEventId]=useState(events[0]?.id??""),[externalEventId,setExternalEventId]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(false)
 async function refresh(){try{const response=await fetch("/api/administration/provider-mappings",{cache:"no-store"});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.mappings))throw Error();setMappings(data.mappings);setError(false)}catch{setError(true)}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[])
 async function add(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);try{const response=await fetch("/api/administration/provider-mappings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,eventId,externalEventId})});if(!response.ok)throw Error();setExternalEventId("");await refresh()}catch{setError(true)}finally{setBusy(false)}}
 async function toggle(mapping:Mapping){if(busy)return;setBusy(true);try{const response=await fetch("/api/administration/provider-mappings/"+encodeURIComponent(mapping.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!mapping.enabled})});if(!response.ok)throw Error();await refresh()}catch{setError(true)}finally{setBusy(false)}}
 return <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{t.notice}</p>
 <form onSubmit={add} className="flex flex-wrap items-end gap-3">
 <label className="flex flex-col gap-1 text-sm">{t.provider}<select className="rounded border bg-background p-2" value={provider} onChange={e=>setProvider(e.target.value as "eventix"|"sumup")}><option value="eventix">Eventix</option><option value="sumup">SumUp</option></select></label>
 <label className="flex flex-col gap-1 text-sm">{t.event}<select className="rounded border bg-background p-2" required value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
 <label className="flex flex-col gap-1 text-sm">{t.external}<input className="rounded border bg-background p-2" required maxLength={160} pattern="[A-Za-z0-9][A-Za-z0-9_.:-]*" value={externalEventId} onChange={e=>setExternalEventId(e.target.value)}/></label>
 <button className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy||!eventId} type="submit">{t.add}</button></form>
 {error&&<p role="alert" className="text-sm text-destructive">{t.error}</p>}
 {loading?<p>{t.loading}</p>:mappings.length===0?<p>{t.empty}</p>:<ul className="space-y-2">{mappings.map(m=><li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span className="text-sm">{m.provider} · {m.external_event_id} · {events.find(e=>e.id===m.event_id)?.name??m.event_id}</span><button type="button" disabled={busy} onClick={()=>void toggle(m)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">{m.enabled?t.disable:t.enable}</button></li>)}</ul>}
 </section>
}
