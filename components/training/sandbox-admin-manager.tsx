"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {useAuth} from "@/lib/providers"
import {tourProgressKey} from "@/lib/tour-training"
import {readDemoScenario,type DemoScenario} from "@/lib/training-demo-scenario"

type Module="events"|"workplaces"|"briefings"|"operations"
type State={name:string;venue:string;start:string;end:string;deadline:string;capacity:string;eventStatus:string;workplace:string;workplaceType:string;lead:string;crew:string;priceItem:string;price:string;briefing:string;instructions:string;checklist:string;confirmed:boolean;acknowledged:boolean;checked:boolean;published:boolean;archived:boolean;rejected:boolean;reason:string;correction:string;approved:boolean;locked:boolean;report:string;file:string}
const d:State={name:"UpTillDawn Trainingsavond",venue:"Leuven",start:"2026-10-10T20:00",end:"2026-10-11T04:00",deadline:"2026-10-10T18:00",capacity:"20",eventStatus:"scheduled",workplace:"Main Bar",workplaceType:"bar",lead:"lina",crew:"noah",priceItem:"Water",price:"2.50",briefing:"Main Bar · Shiftbriefing",instructions:"Controleer de barvoorraad, prijslijst, kassa en nooduitgangen. Meld defecten aan Lina Peeters.",checklist:"Koeling, wisselgeld, EHBO en kassa controleren.",confirmed:false,acknowledged:false,checked:false,published:false,archived:false,rejected:false,reason:"",correction:"",approved:false,locked:false,report:"",file:""}
const c=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const names:Record<Module,string>={events:"events",workplaces:"workplaces",briefings:"briefings",operations:"operations"}
export function SandboxAdminManager({module}:{module:Module}){
 const {profile}=useAuth()
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [s,setS]=useState<State>(d)
 const [demo,setDemo]=useState<DemoScenario|null>(null)
 const [notice,setNotice]=useState("")
 const [opened,setOpened]=useState(false)
 const [log,setLog]=useState<string[]>([])
 const key="uptilldawn-admin-training-"+names[module]+":v1"
 useEffect(()=>{const run=()=>setL(activeUiLocale());run();addEventListener(LANGUAGE_APPLIED_EVENT,run);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,run)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const raw=JSON.parse(sessionStorage.getItem(key)||"null");if(raw&&typeof raw==="object")setS({...d,...raw})}catch{} });return()=>cancelAnimationFrame(frame)},[key])
 useEffect(()=>{const run=()=>{if(profile?.id)setDemo(readDemoScenario(tourProgressKey(profile.id,"admin","")))};const frame=requestAnimationFrame(run);addEventListener("uptilldawn-training-demo-updated",run);return()=>{cancelAnimationFrame(frame);removeEventListener("uptilldawn-training-demo-updated",run)}},[profile?.id])
 const set=<K extends keyof State>(name:K,value:State[K])=>{setS(old=>{const next={...old,[name]:value};sessionStorage.setItem(key,JSON.stringify(next));return next});setNotice("")}
 const act=(label:string,update:Partial<State>={})=>{setS(old=>{const next={...old,...update};sessionStorage.setItem(key,JSON.stringify(next));return next});setLog(old=>[label,...old].slice(0,10));setNotice(c(l,"Demoactie uitgevoerd, er zijn geen productiegegevens gewijzigd.","Demo action completed; no production data changed.","Action démo effectuée, aucune donnée de production modifiée.","Demoaktion durchgeführt, keine Produktionsdaten verändert."))}
 const label="grid gap-1 text-sm font-semibold"
 const input="w-full rounded-lg border bg-background px-3 py-2 text-foreground"
 const button="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
 const title=module==="events"?c(l,"Evenementenbeheer","Event management","Gestion d’événements","Eventverwaltung"):module==="workplaces"?c(l,"Werkplekken en shiften","Workplaces and shifts","Postes et services","Arbeitsplätze und Schichten"):module==="briefings"?c(l,"Briefings en instructies","Briefings and instructions","Briefings et consignes","Briefings und Anweisungen"):c(l,"Werkuren en ploegopvolging","Work hours and team operations","Heures et suivi de l’équipe","Arbeitszeiten und Teamüberwachung")
 const record=(name:keyof State,title:string,type="text")=><label className={label}>{title}<input className={input} type={type} value={String(s[name])} onChange={e=>set(name,e.target.value as never)}/></label>
 const crew=[["lina","Lina Peeters"],["noah","Noah Jacobs"],["mila","Mila Vermeulen"]]
 const worker=(field:"lead"|"crew",text:string)=><label className={label}>{text}<select className={input} value={s[field]} onChange={e=>set(field,e.target.value)}>{crew.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
 return <main data-tour-demo="training-screen" data-training-admin-module={module} className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-8">
  <header className="rounded-2xl border border-violet-500/50 bg-violet-500/5 p-5">
   <p className="text-xs font-black uppercase text-violet-600">{c(l,"ADMIN · GEÏSOLEERDE EVENTDEMO","ADMIN · ISOLATED EVENT DEMO","ADMIN · DÉMO ÉVÉNEMENT ISOLÉE","ADMIN · ISOLIERTE EVENT-DEMO")}</p>
   <h1 className="mt-2 text-2xl font-black">{title}</h1>
   <p className="mt-1 text-sm">{demo?.eventName||s.name} · {demo?.workplaceName||s.workplace} · {c(l,"12 ingeschreven / 20 plaatsen · 3 werkende crew","12 registered / 20 places · 3 working crew","12 inscrits / 20 places · 3 équipiers actifs","12 angemeldet / 20 Plätze · 3 aktive Crew")}</p>
  </header>
  {module==="events"&&<>
   <section className="grid gap-4 rounded-xl border p-5 md:grid-cols-2"><h2 className="col-span-full text-lg font-black">{c(l,"Evenement aanmaken en publiceren","Create and publish an event","Créer et publier un événement","Event erstellen und veröffentlichen")}</h2>
    {record("name",c(l,"Evenementnaam","Event name","Nom de l’événement","Eventname"))}
    {record("venue",c(l,"Locatie en adres","Venue and address","Lieu et adresse","Ort und Adresse"))}
    {record("start",c(l,"Start evenement","Event starts","Début événement","Eventbeginn"),"datetime-local")}
    {record("end",c(l,"Einde evenement","Event ends","Fin événement","Eventende"),"datetime-local")}
    {record("deadline",c(l,"Aanmelddeadline","Registration deadline","Clôture des inscriptions","Anmeldefrist"),"datetime-local")}
    {record("capacity",c(l,"Maximaal personeel","Maximum staff","Personnel maximum","Maximales Personal"),"number")}
    <div className="col-span-full flex flex-wrap gap-3"><button type="button" className={button} data-training-admin-action="publish-event" disabled={!s.name.trim()||!s.venue.trim()||!s.capacity||s.start>=s.end||s.deadline>s.start} onClick={()=>act(c(l,"Evenement gepubliceerd","Event published","Événement publié","Event veröffentlicht"),{published:true,archived:false})}>{c(l,"EVENEMENT PUBLICEREN","PUBLISH EVENT","PUBLIER L’ÉVÉNEMENT","EVENT VERÖFFENTLICHEN")}</button>
    <button type="button" className={button} data-training-admin-action="archive-event" disabled={!s.published||s.archived} onClick={()=>act(c(l,"Evenement gearchiveerd","Event archived","Événement archivé","Event archiviert"),{archived:true})}>{c(l,"ARCHIVEER EVENT","ARCHIVE EVENT","ARCHIVER L’ÉVÉNEMENT","EVENT ARCHIVIEREN")}</button>
    <button type="button" className={button} data-training-admin-action="restore-event" disabled={!s.archived} onClick={()=>act(c(l,"Evenement hersteld","Event restored","Événement restauré","Event wiederhergestellt"),{archived:false})}>{c(l,"HERSTELLEN","RESTORE","RESTAURER","WIEDERHERSTELLEN")}</button></div>
   </section>
   <section className="rounded-xl border p-5"><h2 className="font-black">{c(l,"Beschikbaarheid, wachtlijst en vrijgekomen plaatsen","Availability, waiting list and open spots","Disponibilité, liste d’attente et places libres","Verfügbarkeit, Warteliste und freie Plätze")}</h2>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">{crew.map(([id,name],i)=><article key={id} className="rounded-lg border p-3"><strong>{name}</strong><p className="text-sm">{i===2?c(l,"Wachtlijst","Waiting list","Liste d’attente","Warteliste"):c(l,"IK KAN","I CAN","JE PEUX","ICH KANN")}</p><button type="button" className={button+" mt-2"} onClick={()=>act(name+" · "+c(l,"Vrije plek toegewezen","Open spot assigned","Place libre attribuée","Freier Platz zugewiesen"))}>{c(l,"PLAATS TOEWIJZEN","ASSIGN SPOT","ATTRIBUER UNE PLACE","PLATZ ZUWEISEN")}</button></article>)}</div>
   </section>
  </>}
  {module==="workplaces"&&<>
   <section className="grid gap-4 rounded-xl border p-5 md:grid-cols-2"><h2 className="col-span-full text-lg font-black">{c(l,"Werkplek aanmaken en shifts koppelen","Create workplace and attach shifts","Créer le poste et lier les services","Arbeitsplatz und Schichten zuordnen")}</h2>
    {record("workplace",c(l,"Werkpleknaam","Workplace name","Nom du poste","Arbeitsplatzname"))}
    <label className={label}>{c(l,"Werkplektype","Workplace type","Type de poste","Arbeitsplatztyp")}<select className={input} value={s.workplaceType} onChange={e=>set("workplaceType",e.target.value)}>{[["bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"],["merch","Merch","Merch","Merch","Merch"],["tokens","Tokens","Tokens","Jetons","Tokens"],["entrance","Inkom & Guestlist","Entrance & Guestlist","Entrée & Guestlist","Eingang & Gästeliste"],["backstage","Backstage Management","Backstage Management","Backstage","Backstage"],["driver","Driver","Driver","Chauffeur","Fahrer"]].map(([id,...copy])=><option key={id} value={id}>{copy[["nl","en","fr","de"].indexOf(l)]}</option>)}</select></label>
    {worker("lead",c(l,"Verantwoordelijke","Responsible lead","Responsable","Verantwortliche"))}
    {worker("crew",c(l,"In te plannen medewerker","Staff to assign","Personnel à affecter","Einzuplanendes Personal"))}
    {record("start",c(l,"Start shift","Shift start","Début service","Schichtbeginn"),"datetime-local")}
    {record("end",c(l,"Einde shift","Shift end","Fin service","Schichtende"),"datetime-local")}
    <button type="button" className={button} data-training-admin-action="save-shift" disabled={!s.workplace.trim()||s.start>=s.end} onClick={()=>act(c(l,"Werkplek en shift ingepland","Workplace and shift scheduled","Poste et service planifiés","Arbeitsplatz und Schicht geplant"))}>{c(l,"WERKPLEK EN SHIFT OPSLAAN","SAVE WORKPLACE & SHIFT","ENREGISTRER POSTE ET SERVICE","ARBEITSPLATZ UND SCHICHT SPEICHERN")}</button>
   </section>
   <section className="grid gap-4 rounded-xl border p-5 md:grid-cols-2"><h2 className="col-span-full text-lg font-black">{c(l,"Prijslijsten Bar/Toog, Merch en Tokens","Price lists for Bar/Counter, Merch and Tokens","Tarifs Bar/Comptoir, Merch et Jetons","Preislisten Bar/Theke, Merch und Tokens")}</h2>
    {record("priceItem",c(l,"Product","Product","Produit","Produkt"))}
    {record("price",c(l,"Prijs in EUR","Price in EUR","Prix en EUR","Preis in EUR"),"number")}
    <label className={label}>{c(l,"Prijslijst uploaden (demo, lokaal)","Upload price list (local demo)","Téléverser un tarif (démo locale)","Preisliste hochladen (lokale Demo)")}<input type="file" className={input} accept=".pdf,.csv,.xlsx,image/*" onChange={e=>set("file",e.target.files?.[0]?.name||"")}/></label>
    <div className="flex items-end"><button type="button" className={button} data-training-admin-action="add-price" disabled={!s.priceItem.trim()||!Number.isFinite(Number(s.price))||Number(s.price)<=0} onClick={()=>act(s.priceItem+" · "+s.price+" EUR")}>{c(l,"PRIJS TOEVOEGEN","ADD PRICE","AJOUTER LE PRIX","PREIS HINZUFÜGEN")}</button></div>
    <p className="col-span-full text-xs">{c(l,"Uploads verlaten dit toestel niet tijdens training.","Training uploads never leave this device.","Les fichiers restent sur cet appareil pendant la formation.","Trainingsdateien verlassen dieses Gerät nicht.")} {s.file}</p>
   </section>
  </>}
  {module==="briefings"&&<>
   <section className="grid gap-4 rounded-xl border p-5"><h2 className="text-lg font-black">{c(l,"Briefing schrijven, openen en bevestigen","Write, open and acknowledge briefing","Rédiger, ouvrir et confirmer le briefing","Briefing verfassen, öffnen und bestätigen")}</h2>
    {record("briefing",c(l,"Briefingtitel","Briefing title","Titre du briefing","Briefingtitel"))}
    <label className={label}>{c(l,"Veiligheids- en werkplekinstructies","Safety and workplace instructions","Consignes de sécurité et de poste","Sicherheits- und Arbeitsplatzanweisungen")}<textarea rows={4} className={input} value={s.instructions} onChange={e=>set("instructions",e.target.value)}/></label>
    <label className={label}>{c(l,"Opstart- en afsluitchecklist","Opening and closing checklist","Checklists d’ouverture et de fermeture","Start- und Abschlusscheckliste")}<textarea rows={3} className={input} value={s.checklist} onChange={e=>set("checklist",e.target.value)}/></label>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} data-training-admin-action="save-briefing" disabled={!s.briefing.trim()||s.instructions.trim().length<15} onClick={()=>act(c(l,"Briefing opgesteld","Briefing created","Briefing créé","Briefing erstellt"),{published:true,acknowledged:false})}>{c(l,"BRIEFING OPSLAAN","SAVE BRIEFING","ENREGISTRER LE BRIEFING","BRIEFING SPEICHERN")}</button>
    <button type="button" className={button} data-training-admin-action="open-briefing" disabled={!s.published} onClick={()=>setOpened(x=>!x)}>{opened?c(l,"SLUIT BRIEFING","CLOSE BRIEFING","FERMER LE BRIEFING","BRIEFING SCHLIESSEN"):c(l,"OPEN BRIEFING","OPEN BRIEFING","OUVRIR LE BRIEFING","BRIEFING ÖFFNEN")}</button></div>
    {opened&&<article className="space-y-3 rounded-xl border p-4"><h3 className="font-black">{s.briefing}</h3><p className="whitespace-pre-wrap">{s.instructions}</p><p className="whitespace-pre-wrap">{s.checklist}</p><label className="flex items-center gap-3"><input type="checkbox" checked={s.confirmed} onChange={e=>set("confirmed",e.target.checked)}/>{c(l,"Ik heb alle instructies gelezen","I read every instruction","J’ai lu toutes les consignes","Ich habe alle Anweisungen gelesen")}</label><button type="button" className={button} data-training-admin-action="ack-briefing" disabled={!s.confirmed} onClick={()=>act(c(l,"Leesbevestiging geregistreerd","Reading acknowledged","Lecture confirmée","Lesebestätigung erfasst"),{acknowledged:true})}>{c(l,"BRIEFING BEVESTIGEN","ACKNOWLEDGE BRIEFING","CONFIRMER LE BRIEFING","BRIEFING BESTÄTIGEN")}</button></article>}
    <p className="text-sm">{c(l,"Leesbevestigingen","Acknowledgements","Confirmations de lecture","Lesebestätigungen")}: {s.acknowledged?"4/4":"3/4"}</p>
   </section>
  </>}
  {module==="operations"&&<>
   <section className="rounded-xl border p-5"><h2 className="text-lg font-black">{c(l,"Actief personeel en pauzetimers","Active staff and break timers","Personnel actif et pauses","Aktives Personal und Pausentimer")}</h2>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{crew.map(([id,name],i)=><article key={id} className="rounded-lg border p-3"><b>{name}</b><p className="text-sm">{i===1?c(l,"Pauze 00:18:12","Break 00:18:12","Pause 00:18:12","Pause 00:18:12"):c(l,"Aan het werk","Working","Au travail","Bei der Arbeit")}</p><p className="text-xs">Main Bar · 20:00–04:00</p></article>)}</div>
   </section>
   <section className="grid gap-4 rounded-xl border p-5"><h2 className="text-lg font-black">{c(l,"Urenstaat nakijken, corrigeren en locken","Review, correct and lock timesheets","Vérifier, corriger et verrouiller les heures","Stundenzettel prüfen, korrigieren und sperren")}</h2>
    {worker("crew",c(l,"Ingediende urenstaat van","Submitted timesheet of","Feuille soumise de","Eingereichter Stundenzettel von"))}
    <article className="rounded-lg border p-3 text-sm"><p>{c(l,"Start 20:00 · pauze 00:00–01:00 · einde 04:00","Start 20:00 · break 00:00–01:00 · end 04:00","Début 20 h · pause 00 h–01 h · fin 04 h","Beginn 20:00 · Pause 00:00–01:00 · Ende 04:00")}</p><b>{c(l,"Netto: 7 uur","Net: 7 hours","Net : 7 heures","Netto: 7 Stunden")}</b></article>
    {record("correction",c(l,"Correctie in uren (bv. 7)","Corrected hours (e.g. 7)","Heures corrigées (p. ex. 7)","Korrigierte Stunden (z. B. 7)"),"number")}
    {record("reason",c(l,"Reden voor correctie of afkeuring (verplicht)","Reason for correction or rejection (required)","Motif de correction ou refus (obligatoire)","Grund für Korrektur oder Ablehnung (Pflicht)"))}
    <div className="flex flex-wrap gap-2"><button type="button" className={button} data-training-admin-action="correct-hours" disabled={s.locked||s.reason.trim().length<5} onClick={()=>act(c(l,"Correctie vastgelegd","Correction recorded","Correction enregistrée","Korrektur erfasst"))}>{c(l,"UREN CORRIGEREN","CORRECT HOURS","CORRIGER LES HEURES","STUNDEN KORRIGIEREN")}</button>
    <button type="button" className={button} data-training-admin-action="reject-hours" disabled={s.locked||s.reason.trim().length<5} onClick={()=>act(c(l,"Urenstaat afgekeurd","Timesheet rejected","Feuille refusée","Stundenzettel abgelehnt"),{rejected:true,approved:false})}>{c(l,"AFKEUREN MET REDEN","REJECT WITH REASON","REFUSER AVEC MOTIF","MIT GRUND ABLEHNEN")}</button>
    <button type="button" className={button} data-training-admin-action="approve-hours" disabled={s.locked} onClick={()=>act(c(l,"Urenstaat goedgekeurd","Timesheet approved","Feuille approuvée","Stundenzettel genehmigt"),{approved:true,rejected:false})}>{c(l,"UREN GOEDKEUREN","APPROVE HOURS","APPROUVER LES HEURES","STUNDEN GENEHMIGEN")}</button>
    <button type="button" className={button} data-training-admin-action="lock-hours" disabled={!s.approved||s.locked} onClick={()=>act(c(l,"Urenstaat vergrendeld","Timesheet locked","Feuille verrouillée","Stundenzettel gesperrt"),{locked:true})}>{c(l,"UREN VERGRENDELEN","LOCK HOURS","VERROUILLER LES HEURES","STUNDEN SPERREN")}</button></div>
   </section>
  </>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-500/60 p-3 text-sm text-emerald-600">{notice}</p>}
  {log.length>0&&<section className="rounded-xl border p-4"><h3 className="font-black">{c(l,"Uitgevoerde demoacties","Completed demo actions","Actions démo effectuées","Ausgeführte Demoaktionen")}</h3><ol className="mt-3 space-y-2">{log.map((item,i)=><li key={i} className="text-sm">✓ {item}</li>)}</ol></section>}
 </main>
}
