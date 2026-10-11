"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Evidence={visited:string[];profile:string;preferred:string;registrationVerified:boolean;eventOpened:boolean;last:string}
const init=():Evidence=>({visited:[],profile:"",preferred:"",registrationVerified:false,eventOpened:false,last:""})
const text=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(role:TourRole)=>"uptilldawn-overview-training-v1:"+role
const labels=[
 ["UpTillDawn Trainingsavond · 20:00–04:00","UpTillDawn Training Night · 20:00–04:00","Soirée UpTillDawn · 20:00–04:00","UpTillDawn Trainingsabend · 20:00–04:00"],
 ["Status: gepland · Leuven · registratie vóór 18:00","Status: scheduled · Leuven · registration before 18:00","Statut : planifié · Louvain · inscription avant 18h","Status: geplant · Leuven · Anmeldung vor 18 Uhr"],
 ["Admin beheert alle posten; verantwoordelijke enkel eigen ploeg; medewerker enkel toegewezen diensten.","Admin manages all workplaces; lead only their team; staff only assigned shifts.","L'admin gère tous les postes ; responsable uniquement son équipe ; personnel uniquement ses shifts.","Admin verwaltet alle Arbeitsplätze; Verantwortliche nur ihr Team; Personal nur zugewiesene Schichten."],
 ["Main Bar, Tokens, Merch, Inkom & Guestlist, Backstage, Driver.","Main Bar, Tokens, Merch, Entrance & Guestlist, Backstage, Driver.","Bar principal, Jetons, Merch, Entrée & Guestlist, Backstage, Chauffeur.","Hauptbar, Tokens, Merch, Eingang & Gästeliste, Backstage, Fahrer."],
 ["Nieuwe shift toegewezen · briefing nog te lezen.","New shift assigned · briefing pending.","Nouveau shift attribué · briefing à lire.","Neue Schicht zugewiesen · Briefing noch lesen."],
 ["Demo-registratie: e-mailadres geverifieerd; admin-goedkeuring nodig vóór toegang.","Demo registration: email verified; admin approval required before access.","Inscription démo : e-mail vérifié ; approbation admin obligatoire.","Demo-Registrierung: E-Mail bestätigt; Admin-Freigabe erforderlich."],
 ["Voltooi je profiel om de opleiding voort te zetten.","Complete your profile before continuing training.","Complétez votre profil avant de poursuivre.","Vervollständige dein Profil vor der Fortsetzung."],
 ["Voorkeuren bepalen de voorgestelde werkplek, niet je definitieve toewijzing.","Preferences suggest a workplace; they do not assign shifts.","Les préférences proposent un poste sans attribution définitive.","Präferenzen schlagen einen Arbeitsplatz vor, ohne feste Zuweisung."],
 ["Kies bij aanmelden uitsluitend de rol waarvoor je toegang hebt.","At sign-in, select only a role you are authorized for.","À la connexion, choisissez uniquement un rôle autorisé.","Wähle beim Login nur eine freigeschaltete Rolle."],
 ["Android: Toevoegen aan startscherm. iOS: Delen → Zet op beginscherm. Windows: Installeer via browser.","Android: Add to home screen. iOS: Share → Add to Home Screen. Windows: Install in browser.","Android : ajouter à l’accueil. iOS : Partager → Écran d’accueil. Windows : installer dans le navigateur.","Android: Zum Startbildschirm. iOS: Teilen → Zum Home-Bildschirm. Windows: Im Browser installieren."],
 ["Help bevat uitleg per functie en de optie de rondleiding opnieuw te starten.","Help provides instructions per function and a tour restart option.","L'aide propose des instructions par fonction et le redémarrage du parcours.","Hilfe enthält Anleitungen je Funktion und einen Neustart der Führung."]
] as const
const byRole={
 admin:[
  ["Actief: Lina Peeters (Bar), Noah Jacobs (Tokens), Mila Vermeulen (Merch).","Active: Lina Peeters (Bar), Noah Jacobs (Tokens), Mila Vermeulen (Merch).","Actifs : Lina Peeters (Bar), Noah Jacobs (Jetons), Mila Vermeulen (Merch).","Aktiv: Lina Peeters (Bar), Noah Jacobs (Tokens), Mila Vermeulen (Merch)."],
  ["Bar: Lina 20:00–04:00. Tokens: Noah 21:00–03:00. Merch: Mila 21:00–03:00 (pauze).","Bar: Lina 20:00–04:00. Tokens: Noah 21:00–03:00. Merch: Mila 21:00–03:00 (break).","Bar : Lina 20h–04h. Jetons : Noah 21h–03h. Merch : Mila 21h–03h (pause).","Bar: Lina 20–04 Uhr. Tokens: Noah 21–03 Uhr. Merch: Mila 21–03 Uhr (Pause)."],
  ["1 ontbrekende check-in · 1 lage voorraad · 1 ongelezen briefing.","1 missing check-in · 1 low stock · 1 unread briefing.","1 pointage manquant · 1 stock faible · 1 briefing non lu.","1 fehlender Check-in · 1 niedriger Bestand · 1 ungelesenes Briefing."],
  ["Bar: Lina Peeters · Tokens: Noah Jacobs · Merch: Mila Vermeulen.","Bar: Lina Peeters · Tokens: Noah Jacobs · Merch: Mila Vermeulen.","Bar : Lina Peeters · Jetons : Noah Jacobs · Merch : Mila Vermeulen.","Bar: Lina Peeters · Tokens: Noah Jacobs · Merch: Mila Vermeulen."]
 ],
 responsible_lead:[
  ["Toegewezen post: Main Bar · shift 20:00–04:00.","Assigned workplace: Main Bar · shift 20:00–04:00.","Poste attribué : Bar principal · shift 20h–04h.","Zugewiesener Arbeitsplatz: Hauptbar · Schicht 20–04 Uhr."],
  ["Lina en Noah aanwezig; Mila nog niet aangewezen.","Lina and Noah present; Mila not checked in yet.","Lina et Noah présents ; Mila pas encore pointée.","Lina und Noah anwesend; Mila noch nicht eingecheckt."],
  ["Lina werkt · Noah in pauze · Mila nog niet gestart.","Lina working · Noah on break · Mila not yet started.","Lina travaille · Noah en pause · Mila pas encore commencée.","Lina arbeitet · Noah in Pause · Mila noch nicht gestartet."],
  ["Hulpvraag: scanner reageert niet · dringend, toegewezen aan Main Bar.","Help request: scanner unresponsive · urgent, assigned to Main Bar.","Aide : scanner ne répond pas · urgent, attribué au Bar principal.","Hilfeanfrage: Scanner reagiert nicht · dringend, Hauptbar zugeordnet."]
 ],
 employee:[
  ["Jouw shift: Main Bar · 20:00–04:00 · verantwoordelijke Lina Peeters.","Your shift: Main Bar · 20:00–04:00 · lead Lina Peeters.","Votre shift : Bar principal · 20h–04h · responsable Lina Peeters.","Deine Schicht: Hauptbar · 20–04 Uhr · Verantwortliche Lina Peeters."],
  ["1 shiftbericht en een briefingbevestiging wachten op jou.","1 shift message and a briefing acknowledgment are pending.","1 message de shift et une confirmation de briefing en attente.","1 Schichtnachricht und eine Briefingbestätigung warten."]
 ]
} as const
export function SandboxOverviewTraining({role}:{role:TourRole}){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [id,setId]=useState("")
 const [opened,setOpened]=useState(false)
 const [draft,setDraft]=useState("")
 const [selected,setSelected]=useState("")
 const [evidence,setEvidence]=useState<Evidence>(init)
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const steps=useMemo(()=>getTrainingOperations(role,"overview"),[role])
 const current:PracticeOperation|undefined=steps.find(step=>step.id===id)
 const segment=current?.id.split(":")[1]
 const index=current?Number(current.id.split(":").at(-1)):-1
 const copy=segment==="shared"?labels[index]:byRole[role][index]
 const detail=copy?copy[l==="nl"?0:l==="en"?1:l==="fr"?2:3]:""
 useEffect(()=>{const run=()=>setL(activeUiLocale());run();addEventListener(LANGUAGE_APPLIED_EVENT,run);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,run)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const stored=JSON.parse(sessionStorage.getItem(key(role))||"null") as Evidence|null;if(stored&&Array.isArray(stored.visited))setEvidence(stored)}catch{}setReady(true)});return()=>cancelAnimationFrame(frame)},[role])
 useEffect(()=>{
  const read=()=>{const next=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(old=>old===next?old:next)}
  read();const obs=new MutationObserver(read);obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>obs.disconnect()
 },[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{setOpened(false);setDraft("");setSelected("");setError("")});return()=>cancelAnimationFrame(frame)},[id])
 const action=()=>{
  if(!current||!ready)return
  let value="reviewed"
  const next:Evidence={...evidence,visited:[...new Set([...evidence.visited,id])],last:id}
  if(current.kind==="inspect"){
   if(!opened)return
   if(id==="overview:shared:0")next.eventOpened=true
   if(id==="overview:shared:5")next.registrationVerified=true
  }
  if(current.kind==="write"){
   if(!next.registrationVerified||draft.trim().length<5){setError(text(l,"Verifieer eerst de demo-registratie en vul minstens vijf tekens in.","Verify demo registration first and enter at least five characters.","Vérifiez l'inscription démo et saisissez au moins cinq caractères.","Bestätige zuerst die Demo-Registrierung und gib mindestens fünf Zeichen ein."));return}
   value=draft.trim();next.profile=value
  }
  if(current.kind==="select"){
   if(!next.profile||!selected){setError(text(l,"Vul eerst het verplichte profielveld in en kies een werkplek.","Complete the required profile field and choose a workplace.","Complétez d'abord le profil requis et choisissez un poste.","Vervollständige zuerst das Pflichtprofil und wähle einen Arbeitsplatz."));return}
   value=selected;next.preferred=selected
   sessionStorage.setItem("uptilldawn-training-preferred-workplace",selected)
  }
  sessionStorage.setItem(key(role),JSON.stringify(next));setEvidence(next);setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role,chapter:"overview",id,kind:current.kind,value}}))
 }
 if(!current||!copy)return null
 return <section data-training-overview={role} className="mt-5 space-y-3 rounded-2xl border border-violet-500/40 p-4">
  <p className="text-xs font-bold uppercase text-violet-500">{text(l,"INTERACTIEVE DEMO · OVERZICHT","INTERACTIVE DEMO · OVERVIEW","DÉMO INTERACTIVE · APERÇU","INTERAKTIVE DEMO · ÜBERSICHT")}</p>
  <h2 className="font-black">{current.title[l]}</h2>
  {current.kind==="inspect"?<>
   <button type="button" data-training-preview-op={id} onClick={()=>setOpened(true)} className="w-full rounded-xl bg-violet-600 p-3 text-left font-bold text-white">{text(l,"OPEN DETAILS","OPEN DETAILS","OUVRIR LES DÉTAILS","DETAILS ÖFFNEN")}</button>
   {opened&&<article data-demo-overview-detail={id} className="rounded-xl border p-3 text-sm">{detail}</article>}
  </>:current.kind==="write"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<input data-demo-overview-profile className="rounded-xl border bg-background p-3" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={text(l,"Fictieve profielnaam","Fictional profile name","Nom fictif du profil","Fiktiver Profilname")}/></label>:<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-overview-preference className="rounded-xl border bg-background p-3" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{text(l,"Kies werkplek","Choose workplace","Choisir un poste","Arbeitsplatz wählen")}</option>{[["bar","Bar / Counter","Bar / Comptoir","Bar / Theke"],["tokens","Tokens","Jetons","Tokens"],["merch","Merch","Merch","Merch"],["entrance","Entrance & Guestlist","Entrée & Guestlist","Eingang & Gästeliste"],["backstage","Backstage","Backstage","Backstage"]].map(([value,en,fr,de])=><option key={value} value={value}>{l==="nl"?(value==="bar"?"Bar / Toog":value==="entrance"?"Inkom & Guestlist":en):l==="en"?en:l==="fr"?fr:de}</option>)}</select></label>}
  <button type="button" data-training-practical-op={id} disabled={!ready||(current.kind==="inspect"&&!opened)} onClick={action} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{current.title[l]}</button>
  {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  <p className="text-xs text-muted-foreground">{text(l,"Geverifieerde demoacties","Verified demo actions","Actions démo vérifiées","Verifizierte Demoaktionen")}: {evidence.visited.length}/{steps.length}</p>
 </section>
}
