"use client"
import {useEffect,useState} from "react"
import {createDriverTransportTask} from "@/lib/actions/uptilldawn"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
export type DriverArtist={id:string;name:string}
export function DriverTransportForm({shiftId,artists=[]}:{shiftId:string;artists?:DriverArtist[]}){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [artistId,setArtistId]=useState(""),[name,setName]=useState("")
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
   <input name="address" required maxLength={500} placeholder={t(l,"Ophaal-/afzetadres","Pickup/drop-off address","Adresse de prise en charge/dépôt","Abhol-/Absetzadresse")} className="rounded-lg border bg-background p-3"/>
   <label className="grid gap-1 text-sm font-semibold md:col-span-2">{t(l,"Gewenst tijdstip","Required time","Heure souhaitée","Gewünschte Uhrzeit")}<input name="scheduled_at" required type="datetime-local" className="rounded-lg border bg-background p-3"/></label>
   <p className="text-xs text-muted-foreground md:col-span-2">{t(l,"Rijtijd en routekilometers worden automatisch berekend. De Driver krijgt 15 minuten vóór de benodigde vertrektijd een melding.","Driving time and route kilometres are calculated automatically. The Driver is notified 15 minutes before the required departure time.","Le temps de trajet et les kilomètres sont calculés automatiquement. Le chauffeur est averti 15 minutes avant l’heure de départ nécessaire.","Fahrzeit und Routenkilometer werden automatisch berechnet. Der Fahrer wird 15 Minuten vor der erforderlichen Abfahrtszeit benachrichtigt.")}</p>
   <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">{t(l,"RIT TOEVOEGEN","ADD TRIP","AJOUTER LE TRAJET","FAHRT HINZUFÜGEN")}</button>
  </form>
 </details>
}