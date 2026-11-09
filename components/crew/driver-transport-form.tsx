"use client"
import {useEffect,useState} from "react"
import {createDriverTransportTask} from "@/lib/actions/uptilldawn"
import {AddressAutocomplete} from "@/components/crew/address-autocomplete"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
export type DriverArtist={id:string;name:string}
export function DriverTransportForm({shiftId,artists=[]}:{shiftId:string;artists?:DriverArtist[]}){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [artistId,setArtistId]=useState(""),[name,setName]=useState("")
 const [onlineRoute,setOnlineRoute]=useState(false)
 useEffect(()=>{const f=()=>setL(activeUiLocale());f();addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 return <details className="mt-3 rounded-lg border border-violet-500/30 p-3">
  <summary className="cursor-pointer font-semibold">{t(l,"Driver-rit toevoegen","Add driver trip","Ajouter un trajet chauffeur","Fahrerfahrt hinzufügen")}</summary>
  <form action={createDriverTransportTask} className="mt-3 grid gap-2 md:grid-cols-2">
   <input type="hidden" name="shift_id" value={shiftId}/>
   <select name="direction" required defaultValue="pickup" className="rounded-lg border bg-background p-3"><option value="pickup">{t(l,"Ophalen","Pick up","Prendre en charge","Abholen")}</option><option value="dropoff">{t(l,"Afzetten","Drop off","Déposer","Absetzen")}</option></select>
   <select name="guestlist_entry_id" value={artistId} onChange={e=>{setArtistId(e.target.value);const a=artists.find(x=>x.id===e.target.value);if(a)setName(a.name)}} className="rounded-lg border bg-background p-3">
    <option value="">{t(l,"Andere persoon / geen artiest","Other person / not an artist","Autre personne / pas un artiste","Andere Person / kein Künstler")}</option>
    {artists.map(a=><option key={a.id} value={a.id}>{t(l,"Artiest","Artist","Artiste","Künstler")} · {a.name}</option>)}
   </select>
   <input name="passenger_name" required maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder={t(l,"Naam persoon","Person name","Nom de la personne","Name der Person")} className="rounded-lg border bg-background p-3"/>
   <input name="passenger_phone" required maxLength={60} type="tel" placeholder={t(l,"Telefoonnummer","Phone number","Numéro de téléphone","Telefonnummer")} className="rounded-lg border bg-background p-3"/>
   <div className="md:col-span-2"><AddressAutocomplete name="address" required label={t(l,"Ophaal-/afzetadres","Pickup/drop-off address","Adresse de prise en charge/dépôt","Abhol-/Absetzadresse")}/></div>
   <label className="flex items-center gap-2 text-sm md:col-span-2"><input name="use_online_route" type="checkbox" checked={onlineRoute} onChange={e=>setOnlineRoute(e.target.checked)}/>{t(l,"Online route en afstand laten berekenen (optioneel, Geoapify)","Calculate route and distance online (optional, Geoapify)","Calculer l’itinéraire en ligne (facultatif, Geoapify)","Route und Entfernung online berechnen (optional, Geoapify)")}</label>
   {!onlineRoute&&<><label className="grid gap-1 text-sm">{t(l,"Geschatte reistijd (minuten)","Estimated travel time (minutes)","Temps de trajet estimé (minutes)","Geschätzte Fahrzeit (Minuten)")}<input required type="number" name="manual_travel_minutes" min={1} max={1440} inputMode="numeric" className="rounded-lg border bg-background p-3"/></label><label className="grid gap-1 text-sm">{t(l,"Geschatte afstand (km)","Estimated distance (km)","Distance estimée (km)","Geschätzte Entfernung (km)")}<input required type="number" name="manual_route_km" min={0.01} max={2000} step={0.01} inputMode="decimal" className="rounded-lg border bg-background p-3"/></label></>}
   <label className="grid gap-1 text-sm font-semibold md:col-span-2">{t(l,"Gewenst tijdstip","Required time","Heure souhaitée","Gewünschte Uhrzeit")}<input name="scheduled_at" required type="datetime-local" className="rounded-lg border bg-background p-3"/></label>
   <p className="text-xs text-muted-foreground md:col-span-2">{t(l,"Standaard zonder route-API: controleer je eigen schatting. De Driver krijgt 15 minuten vóór de berekende vertrektijd een melding.","No route API by default: verify your estimate. The Driver is notified 15 minutes before the computed departure time.","Sans API d’itinéraire par défaut : vérifiez votre estimation. Le chauffeur reçoit une notification 15 minutes avant le départ prévu.","Standardmäßig ohne Routing-API: Schätzung prüfen. Der Fahrer wird 15 Minuten vor der berechneten Abfahrt benachrichtigt.")}</p>
   <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">{t(l,"RIT TOEVOEGEN","ADD TRIP","AJOUTER LE TRAJET","FAHRT HINZUFÜGEN")}</button>
  </form>
 </details>
}