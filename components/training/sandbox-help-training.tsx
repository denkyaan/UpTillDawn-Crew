"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const articles=[
 ["Open eerst het trainingshoofdstuk in de navigatie. De paarse knop duidt de verplichte handeling aan. Alles gebeurt met fictieve accounts, evenementen en werkuren.",
  "Open the training chapter in navigation. The purple button marks the required action. All records use fictional accounts, events and work hours.",
  "Ouvrez le chapitre dans la navigation. Le bouton violet indique l'action obligatoire. Toutes les données de formation sont fictives.",
  "Öffne das Trainingskapitel in der Navigation. Die violette Schaltfläche zeigt die Pflichtaktion. Alle Trainingsdaten sind fiktiv."],
 ["Zoek op bijvoorbeeld 'briefing' om de instructies voor het lezen en bevestigen van een shiftbriefing te vinden.",
  "Search for 'briefing' to find instructions for opening, reading and acknowledging a shift briefing.",
  "Recherchez « briefing » pour trouver les instructions d'ouverture, de lecture et de confirmation d'un briefing.",
  "Suche nach 'briefing', um die Anleitung zum Öffnen, Lesen und Bestätigen einer Schichtbesprechung zu finden."],
 ["Personeel ziet toegewezen diensten, taken en uren. Verantwoordelijke beheert uitsluitend de eigen ploeg en werkplek. Admin beheert planning, personeel, goedkeuringen en exports.",
  "Staff see assigned shifts, tasks and hours. Leads manage only their workplace and team. Admins manage schedules, staff, approvals and exports.",
  "Le personnel voit ses shifts, tâches et heures. Le responsable gère uniquement son poste et son équipe. L'admin gère la planification, les comptes, les approbations et les exports.",
  "Personal sieht zugewiesene Schichten, Aufgaben und Zeiten. Verantwortliche betreuen nur ihr Team und ihren Arbeitsplatz. Admins verwalten Planung, Personal, Genehmigungen und Exporte."],
 ["De volledige opleiding gaat van registratie en evenementplanning via briefing, check-in, pauzes, taken, inventaris en chat tot urenstaat en archivering. Hoofdstukken kunnen apart opnieuw worden geopend.",
  "The full curriculum runs from registration and event planning through briefings, check-in, breaks, tasks, inventory and chat to timesheets and archiving. Chapters may be restarted separately.",
  "Le programme va de l'inscription et de la planification à la feuille d'heures et à l'archivage, en passant par le briefing, le pointage, les pauses, les tâches, l'inventaire et le chat.",
  "Der Lehrplan führt von Registrierung und Eventplanung über Briefing, Check-in, Pausen, Aufgaben, Inventar und Chat bis zum Stundenzettel und zur Archivierung."],
 ["Gebruik de evenement-QR uitsluitend waarvoor deze is ingericht, bijvoorbeeld de toegang tot de evenementinformatie. Scan geen willekeurige QR als bewijs van werkuren: aanwijzing en urenregistratie zijn afzonderlijke handelingen.",
  "Use the event QR only for its configured purpose, such as opening event information. Scanning any QR is not proof of work: check-in and time tracking are separate actions.",
  "Utilisez le QR de l'événement uniquement pour son usage prévu, par exemple accéder aux informations. Le pointage et les heures sont des actions distinctes.",
  "Verwende den Event-QR nur für seinen vorgesehenen Zweck, z. B. Eventinformationen. Check-in und Arbeitszeiterfassung sind getrennte Aktionen."],
 ["Via Help kan je een hoofdstuk kiezen of de rondleiding hervatten. Opnieuw starten van de volledige opleiding moet een bewuste keuze zijn; afgeronde stappen worden niet automatisch overgeslagen.",
  "Help lets you choose a chapter or resume your tour. Restarting the full curriculum is an explicit choice; incomplete operations are never silently skipped.",
  "L'aide permet de choisir un chapitre ou de reprendre la visite. Le redémarrage complet est un choix explicite ; aucune action inachevée n'est ignorée.",
  "Über Hilfe kannst du Kapitel wählen oder die Führung fortsetzen. Ein vollständiger Neustart ist bewusst; unerledigte Aktionen werden nicht übersprungen."],
 ["Nieuwe gebruikers registreren, verifiëren hun e-mailadres en wachten op goedkeuring van Admin. Na goedkeuring vullen ze het verplichte profiel aan, kiezen voorkeuren en starten de rolopleiding.",
  "New users register, verify their email and wait for admin approval. Once approved, they complete the mandatory profile, select preferences and start role training.",
  "Les nouveaux utilisateurs s'inscrivent, vérifient leur e-mail et attendent l'approbation de l'admin. Ils complètent ensuite leur profil obligatoire et démarrent la formation.",
  "Neue Benutzer registrieren sich, bestätigen die E-Mail und warten auf Admin-Freigabe. Danach vervollständigen sie ihr Pflichtprofil und starten das Rollentraining."],
 ["Geen verificatiemail ontvangen? Controleer spam en het ingevoerde e-mailadres. Gebruik de optie om de verificatiemail opnieuw te verzenden; de oefening verstuurt geen echte e-mail.",
  "No verification email? Check spam and the entered address. Use resend verification. This exercise does not send a real email.",
  "Aucun e-mail de vérification ? Vérifiez les spams et l'adresse saisie, puis renvoyez le lien de vérification. Cette simulation n'envoie aucun e-mail.",
  "Keine Bestätigungsmail? Prüfe Spam und E-Mail-Adresse und fordere den Link erneut an. Diese Übung verschickt keine echte E-Mail."],
 ["Gebruik op het inlogscherm de functie voor een vergeten wachtwoord. Open de herstelmail via een vertrouwd apparaat en stel een nieuw wachtwoord in. Deel geen herstelcodes.",
  "Use Forgot password on the login screen. Open the recovery email on a trusted device and set a new password. Do not share recovery codes.",
  "Utilisez Mot de passe oublié sur l'écran de connexion. Ouvrez l'e-mail de récupération sur un appareil fiable et créez un nouveau mot de passe. Ne partagez aucun code.",
  "Nutze Passwort vergessen auf der Login-Seite. Öffne die Wiederherstellungs-E-Mail auf einem vertrauenswürdigen Gerät und setze ein neues Passwort. Teile keine Codes."]
] as const
type Evidence={read:string[];search:string;last:string}
const empty=():Evidence=>({read:[],search:"",last:""})
const key=(role:TourRole)=>"uptilldawn-help-training-v1:"+role
export function SandboxHelpTraining({role}:{role:TourRole}){
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [id,setId]=useState("")
 const [opened,setOpened]=useState("")
 const [query,setQuery]=useState("")
 const [data,setData]=useState<Evidence>(empty)
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const ops=useMemo(()=>getTrainingOperations(role,"help"),[role])
 const current=ops.find(x=>x.id===id)
 const index=current?Number(id.split(":").at(-1)):-1
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const state=JSON.parse(sessionStorage.getItem(key(role))||"null") as Evidence|null;if(state&&Array.isArray(state.read))setData(state)}catch{}setHydrated(true)});return()=>cancelAnimationFrame(frame)},[role])
 useEffect(()=>{
  const sync=()=>{const value=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(old=>old===value?old:value)}
  sync();const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 const record=()=>{
  if(!hydrated||!current)return
  let value="reviewed"
  if(current.kind==="write"){
   value=query.trim()
   if(value.length<3||!["briefing","qr","shift","werk","aide"].some(term=>value.toLowerCase().includes(term))){
    setError(T(locale,"Zoek naar een bestaand onderwerp, bijvoorbeeld briefing.","Search for an existing topic, for example briefing.","Recherchez un sujet existant, par exemple briefing.","Suche nach einem vorhandenen Thema, zum Beispiel Briefing."))
    return
   }
  }else if(opened!==id)return
  const next:Evidence={read:[...new Set([...data.read,id])],search:current.kind==="write"?value:data.search,last:id}
  sessionStorage.setItem(key(role),JSON.stringify(next))
  setData(next);setOpened("");setQuery("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role,chapter:"help",id,kind:current.kind,value}}))
 }
 if(!current||index<0||index>=articles.length)return null
 return <section data-training-help="true" className="space-y-4 rounded-2xl border border-violet-500/50 p-4">
  <header><p className="text-xs font-bold uppercase text-violet-500">{T(locale,"Oefen met echte Help-functies","Practise actual Help functions","Exercer les fonctions d'aide","Echte Hilfefunktionen üben")}</p><h2 className="text-lg font-black">{current.title[locale]}</h2></header>
  {current.kind==="write"?<label className="grid gap-2 text-sm font-bold">{T(locale,"Zoek in de handleiding","Search the guide","Rechercher dans le guide","Im Handbuch suchen")}
    <input data-demo-help-search value={query} onChange={e=>setQuery(e.target.value)} className="rounded-xl border bg-background p-3" placeholder={T(locale,"bijvoorbeeld briefing","for example briefing","par exemple briefing","z. B. Briefing")}/></label>
   :<button type="button" data-demo-help-open onClick={()=>setOpened(id)} className="w-full rounded-xl border border-violet-500 p-3 text-left font-bold">{T(locale,"OPEN UITLEG","OPEN INSTRUCTIONS","OUVRIR LES INSTRUCTIONS","ANLEITUNG ÖFFNEN")}</button>}
  {(opened===id||current.kind==="write"&&query.length>=3)&&<article data-demo-help-article={id} className="space-y-2 rounded-xl border p-3">
   <h3 className="font-semibold">{current.title[locale]}</h3><p className="text-sm">{articles[index][locale==="nl"?0:locale==="en"?1:locale==="fr"?2:3]}</p>
   {index===2&&<p className="text-sm font-semibold">{role==="admin"?"Admin":role==="responsible_lead"?T(locale,"Verantwoordelijke","Responsible lead","Responsable","Verantwortlich"):T(locale,"Personeel","Staff","Personnel","Personal")}</p>}
  </article>}
  <button type="button" data-training-practical-op={id} disabled={!hydrated||(current.kind==="inspect"&&opened!==id)} onClick={record} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{current.kind==="write"?T(locale,"ZOEK RESULTAAT BEVESTIGEN","CONFIRM SEARCH RESULT","CONFIRMER LE RÉSULTAT","SUCHERGEBNIS BESTÄTIGEN"):T(locale,"INSTRUCTIES GELEZEN","INSTRUCTIONS READ","INSTRUCTIONS LUES","ANLEITUNG GELESEN")}</button>
  {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  <p className="text-xs text-muted-foreground">{T(locale,"Gelezen onderdelen","Reviewed sections","Sections lues","Gelesene Abschnitte")}: {data.read.length}/{ops.length}</p>
 </section>
}
