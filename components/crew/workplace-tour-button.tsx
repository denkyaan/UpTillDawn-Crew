'use client'

import {useEffect,useState} from 'react'
import {LANGUAGE_APPLIED_EVENT,activeUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(name:string)=>{
 const n=name.toLowerCase()
 if(n.includes('guest')||n.includes('inkom')||n.includes('ticket'))return 'entrance'
 if(n.includes('merch'))return 'merch'
 if(n.includes('token'))return 'tokens'
 if(n.includes('driver'))return 'driver'
 if(n.includes('bar')||n.includes('toog'))return 'bar'
 if(n.includes('backstage'))return 'backstage'
 if(n.includes('opbouw')||n.includes('setup'))return 'setup'
 if(n.includes('afbouw')||n.includes('breakdown'))return 'breakdown'
 return 'allround'
}
export function WorkplaceTourButton({workplaceName,roleName}:{workplaceName:string;roleName:string}){
 const [open,setOpen]=useState(false)
 const [step,setStep]=useState(0)
 const [l,setL]=useState<SupportedUiLocale>('nl')
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const common=[
  t(l,'Lees eerst de briefing van deze shift en controleer je werkplek en uren.','First read this shift briefing and check your workplace and hours.','Lisez d’abord le briefing de ce shift et vérifiez votre poste et vos heures.','Lies zuerst das Briefing dieser Schicht und prüfe Arbeitsplatz und Zeiten.'),
  t(l,'Meld je bij de verantwoordelijke en voer de check-in uit wanneer je shift start.','Report to the responsible lead and check in when your shift starts.','Présentez-vous au responsable et effectuez le check-in au début du shift.','Melde dich bei der verantwortlichen Person und checke zu Schichtbeginn ein.'),
 ]
 const specific:Record<string,string[]>={
  entrance:[t(l,'Gebruik Inkom & Guestlist voor ticketcontrole, gasten en artiestenaankomsten.','Use Entrance & Guestlist for ticket checks, guests and artist arrivals.','Utilisez Entrée & Guestlist pour les tickets, invités et arrivées d’artistes.','Nutze Eingang & Gästeliste für Ticketkontrolle, Gäste und Künstlerankünfte.')],
  merch:[t(l,'Controleer de merchvoorraad en prijslijst en registreer verkopen volgens de werkplekinstructies.','Check merchandise stock and the price list and register sales according to workplace instructions.','Contrôlez le stock merch et la liste de prix et enregistrez les ventes selon les instructions du poste.','Prüfe Merch-Bestand und Preisliste und erfasse Verkäufe gemäß den Arbeitsplatzanweisungen.')],
  bar:[t(l,'Controleer barvoorraad en prijslijst en volg de afgesproken kassawerkwijze.','Check bar stock and the price list and follow the agreed till procedure.','Contrôlez le stock du bar et la liste de prix et suivez la procédure de caisse.','Prüfe Barbestand und Preisliste und befolge den vereinbarten Kassenablauf.')],
  tokens:[t(l,'Controleer de tokenkassa, tokenvoorraad en actuele tokenprijs. Registreer de tokenverkoop en uitgifte volgens de werkplekinstructies.','Check the token till, token stock and current token price. Register token sales and issuance according to workplace instructions.','Contrôlez la caisse à jetons, le stock et le prix actuel des jetons. Enregistrez les ventes et la distribution selon les instructions du poste.','Prüfe Tokenkasse, Tokenbestand und aktuellen Tokenpreis. Erfasse Tokenverkauf und Ausgabe gemäß den Arbeitsplatzanweisungen.')],
  driver:[t(l,'Controleer vóór vertrek je toegewezen rit: ophalen of afzetten, naam, telefoonnummer, adres en afgesproken tijdstip. De app berekent de autorijtijd vanaf het evenement en waarschuwt je 15 minuten vóór de benodigde vertrektijd.','Before departure, check your assigned trip: pickup or drop-off, name, phone number, address and agreed time. The app calculates driving time from the event and warns you 15 minutes before the required departure time.','Avant le départ, vérifiez le trajet attribué : prise en charge ou dépôt, nom, numéro de téléphone, adresse et heure convenue. L’application calcule le temps de trajet depuis l’événement et vous avertit 15 minutes avant l’heure de départ nécessaire.','Prüfe vor der Abfahrt deine zugewiesene Fahrt: Abholen oder Absetzen, Name, Telefonnummer, Adresse und vereinbarte Uhrzeit. Die App berechnet die Fahrzeit ab dem Event und warnt dich 15 Minuten vor der erforderlichen Abfahrtszeit.')],
  backstage:[t(l,'Volg artiestenaankomsten, hospitality en de backstagechecklist en bevestig wat klaarstaat.','Follow artist arrivals, hospitality and the backstage checklist and confirm what is ready.','Suivez les arrivées d’artistes, l’hospitality et la checklist backstage et confirmez ce qui est prêt.','Verfolge Künstlerankünfte, Hospitality und die Backstage-Checkliste und bestätige, was bereitsteht.')],
  setup:[t(l,'Volg de opbouwtaken en checklist van je werkplek en meld ontbrekend of beschadigd materiaal.','Follow your workplace setup tasks and checklist and report missing or damaged material.','Suivez les tâches et la checklist de montage et signalez le matériel manquant ou endommagé.','Befolge Aufbauaufgaben und Checkliste und melde fehlendes oder beschädigtes Material.')],
  breakdown:[t(l,'Volg de afbouwtaken en eindchecklist en registreer ontbrekend of beschadigd materiaal.','Follow breakdown tasks and the closing checklist and record missing or damaged material.','Suivez les tâches de démontage et la checklist de clôture et signalez le matériel manquant ou endommagé.','Befolge Abbauaufgaben und Abschlusscheckliste und erfasse fehlendes oder beschädigtes Material.')],
  allround:[t(l,'Volg de taken die je verantwoordelijke toewijst en controleer bij elke verplaatsing naar welke werkplek je wordt gestuurd.','Follow tasks assigned by your responsible lead and check which workplace you are sent to for each reassignment.','Suivez les tâches attribuées par votre responsable et vérifiez le poste vers lequel vous êtes envoyé à chaque changement.','Befolge die Aufgaben deiner verantwortlichen Person und prüfe bei jedem Wechsel, welchem Arbeitsplatz du zugeteilt wirst.')],
 }
 const steps=[...common,...specific[key(workplaceName)],t(l,'Gebruik tijdens je shift Taken, Chat en Help wanneer dat nodig is en registreer je pauze en werkstop via Mijn werkuren.','During your shift use Tasks, Chat and Help when needed, and record your break and work stop in My work hours.','Pendant votre shift, utilisez Tâches, Chat et Aide si nécessaire et enregistrez votre pause et fin de travail via Mes heures.','Nutze während deiner Schicht Aufgaben, Chat und Hilfe bei Bedarf und erfasse Pause und Arbeitsende unter Meine Arbeitszeiten.')]
 return <>
  <button type="button" onClick={()=>{setStep(0);setOpen(true)}} className="w-full rounded-lg border border-violet-500/50 p-3 font-bold">{t(l,'WERKPLEK TOUR','WORKPLACE TOUR','VISITE DU POSTE','ARBEITSPLATZ-TOUR')}</button>
  {open&&<div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
   <section className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl">
    <p className="text-xs font-black uppercase tracking-[.18em] text-violet-500">{t(l,'Shifttraining','Shift training','Formation du shift','Schichttraining')}</p>
    <h2 className="mt-1 text-xl font-black">{workplaceName}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{roleName}</p>
    <p className="mt-4 text-sm leading-6">{steps[step]}</p>
    <div className="mt-5 flex gap-2">
     <button type="button" onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-3 font-bold">{t(l,'SLUITEN','CLOSE','FERMER','SCHLIESSEN')}</button>
     {step<steps.length-1&&<button type="button" onClick={()=>setStep(v=>v+1)} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{t(l,'VOLGENDE','NEXT','SUIVANT','WEITER')}</button>}
     {step===steps.length-1&&<button type="button" onClick={()=>setOpen(false)} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{t(l,'KLAAR','DONE','TERMINÉ','FERTIG')}</button>}
    </div>
   </section>
  </div>}
 </>
}
