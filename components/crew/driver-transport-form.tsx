"use client"
import {useEffect,useState} from "react"
import {createDriverTransportTask} from "@/lib/actions/uptilldawn"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])

export function DriverTransportForm({shiftId}:{shiftId:string}){
 const [l,setL]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
 useEffect(()=>{const f=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 return <details className="mt-3 rounded-lg border border-violet-500/30 p-3">
  <summary className="cursor-pointer font-semibold">{t(l,"Driver-rit toevoegen","Add driver trip","Ajouter un trajet chauffeur","Fahrerfahrt hinzufügen")}</summary>
  <form action={createDriverTransportTask} className="mt-3 grid gap-2 md:grid-cols-2">
   <input type="hidden" name="shift_id" value={shiftId}/>
   <select name="direction" required defaultValue="pickup" className="rounded-lg border bg-background p-3">
    <option value="pickup">{t(l,"Ophalen","Pick up","Prendre en charge","Abholen")}</option>
    <option value="dropoff">{t(l,"Afzetten","Drop off","Déposer","Absetzen")}</option>
   </select>
   <input name="passenger_name" required maxLength={200} placeholder={t(l,"Naam persoon","Person name","Nom de la personne","Name der Person")} className="rounded-lg border bg-background p-3"/>
   <input name="passenger_phone" required maxLength={60} type="tel" placeholder={t(l,"Telefoonnummer","Phone number","Numéro de téléphone","Telefonnummer")} className="rounded-lg border bg-background p-3"/>
   <input name="address" required maxLength={500} placeholder={t(l,"Ophaal-/afzetadres","Pickup/drop-off address","Adresse de prise en charge/dépôt","Abhol-/Absetzadresse")} className="rounded-lg border bg-background p-3"/>
   <label className="grid gap-1 text-sm font-semibold md:col-span-2">{t(l,"Tijdstip","Time","Heure","Zeitpunkt")}<input name="scheduled_at" required type="datetime-local" className="rounded-lg border bg-background p-3"/></label>
   <p className="text-xs text-muted-foreground md:col-span-2">{t(l,"De autorijtijd tussen het evenement en het adres wordt automatisch berekend. De driver krijgt 15 minuten vóór de benodigde vertrektijd een melding.","Driving time between the event and address is calculated automatically. The driver is notified 15 minutes before the required departure time.","Le temps de trajet entre l’événement et l’adresse est calculé automatiquement. Le chauffeur reçoit une notification 15 minutes avant l’heure de départ nécessaire.","Die Fahrzeit zwischen Event und Adresse wird automatisch berechnet. Der Fahrer erhält 15 Minuten vor der erforderlichen Abfahrtszeit eine Benachrichtigung.")}</p>
   <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">{t(l,"RIT TOEVOEGEN","ADD TRIP","AJOUTER LE TRAJET","FAHRT HINZUFÜGEN")}</button>
  </form>
 </details>
}
