"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {syncBrowserTrainingScenario,loadOwnedTrainingScenario,addTrainingParticipant,getOwnedTrainingScenarioId} from "@/lib/training/scenario-sync"

import {TrainingQuestionsPanel} from "@/components/training/training-questions-panel"
import {listTrainingProgressReports} from "@/lib/training/progress-sync"

const KEY="uptilldawn-training-workflow-v3"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
type EventDraft={name:string;venue:string;start:string;end:string;deadline:string;capacity:string}
const empty:EventDraft={name:"",venue:"",start:"",end:"",deadline:"",capacity:""}
export function SandboxAdminEvent(){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [draft,setDraft]=useState<EventDraft>(empty)
 const [created,setCreated]=useState(false)
 const [published,setPublished]=useState(false)
 const [error,setError]=useState("")
 const [scenarioId,setScenarioId]=useState("")
 const [participantId,setParticipantId]=useState("")
 const [participantMessage,setParticipantMessage]=useState("")
 const [reports,setReports]=useState<Awaited<ReturnType<typeof listTrainingProgressReports>>>([])
 const [reportMessage,setReportMessage]=useState("")
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const s=JSON.parse(sessionStorage.getItem(KEY)||"{}");if(s.adminEventDraft)setDraft(s.adminEventDraft);setCreated(Boolean(s.adminEventCreated));setPublished(Boolean(s.adminEventPublished))}catch{}});return()=>cancelAnimationFrame(frame)},[])
 useEffect(()=>{let cancelled=false;void loadOwnedTrainingScenario().then(remote=>{if(cancelled||!remote)return;const local=JSON.parse(sessionStorage.getItem(KEY)||"{}");if(local.adminEventCreated)return;sessionStorage.setItem(KEY,JSON.stringify(remote));if(remote.adminEventDraft)setDraft(remote.adminEventDraft as EventDraft);setCreated(Boolean(remote.adminEventCreated));setPublished(Boolean(remote.adminEventPublished))}).catch(()=>{});return()=>{cancelled=true}},[])
 const persist=(patch:Record<string,unknown>)=>{let s={};try{s=JSON.parse(sessionStorage.getItem(KEY)||"{}")}catch{}sessionStorage.setItem(KEY,JSON.stringify({...s,...patch}));void syncBrowserTrainingScenario().catch(()=>setError(t(l,"Lokaal opgeslagen; synchronisatie mislukt.","Saved locally; sync failed.","Enregistré localement ; synchronisation échouée.","Lokal gespeichert; Synchronisierung fehlgeschlagen.")))}
 const update=(field:keyof EventDraft,value:string)=>{setDraft(old=>({...old,[field]:value}));setError("")}
 const create=()=>{
  if(!draft.name.trim()||!draft.venue.trim()||!draft.start||!draft.end||!draft.deadline||!draft.capacity){setError(t(l,"Vul alle velden in.","Complete all fields.","Complétez tous les champs.","Fülle alle Felder aus."));return}
  if(new Date(draft.end)<=new Date(draft.start)||new Date(draft.deadline)>=new Date(draft.start)||Number(draft.capacity)<1||!Number.isInteger(Number(draft.capacity))){setError(t(l,"Controleer de uren, deadline en capaciteit.","Check the times, deadline and capacity.","Vérifiez les heures, la date limite et la capacité.","Prüfe Zeiten, Frist und Kapazität."));return}
  setCreated(true);persist({adminEventCreated:true,adminEventDraft:draft})
 }
 const publish=()=>{setPublished(true);persist({adminEventPublished:true,adminEventDraft:draft,navTarget:"workplaces"});dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:"workplaces"}}))}
 const fieldClass="w-full rounded-xl border bg-background px-3 py-2 text-sm"
 return <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-6" data-tour-demo="training-screen">
  <header><p className="text-xs font-bold uppercase text-violet-400">{t(l,"TRAINING · FICTIEVE GEGEVENS","TRAINING · FICTIONAL DATA","FORMATION · DONNÉES FICTIVES","TRAINING · FIKTIVE DATEN")}</p><h1 className="mt-2 text-2xl font-black">{t(l,"Maak zelf een evenement","Create an event yourself","Créez vous-même un événement","Erstelle selbst ein Event")}</h1><p className="mt-2 text-sm text-muted-foreground">{t(l,"Vul alle gegevens zelf in. Dit oefenevenement wordt alleen in je browsersessie opgeslagen.","Enter all details yourself. This practice event is stored only in your browser session.","Saisissez vous-même toutes les données. Cet événement fictif reste dans votre session.","Gib alle Daten selbst ein. Dieses Übungsevent wird nur in deiner Browsersitzung gespeichert.")}</p></header>
  <form onSubmit={e=>{e.preventDefault();create()}} className="space-y-4 rounded-2xl border bg-card p-4">
   <label className="block space-y-1 text-sm font-semibold">{t(l,"Naam evenement","Event name","Nom de l’événement","Eventname")}<input data-tour-demo="primary-action" className={fieldClass} required value={draft.name} disabled={created} onChange={e=>update("name",e.target.value)} placeholder={t(l,"Voorbeeld: Trainingsavond","Example: Training Night","Exemple : Soirée de formation","Beispiel: Trainingsabend")}/></label>
   <label className="block space-y-1 text-sm font-semibold">{t(l,"Locatie","Venue","Lieu","Veranstaltungsort")}<input className={fieldClass} required value={draft.venue} disabled={created} onChange={e=>update("venue",e.target.value)} placeholder={t(l,"Bijvoorbeeld Leuven","For example Leuven","Par exemple Louvain","Zum Beispiel Leuven")}/></label>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Startdatum en uur","Start date and time","Début","Beginn")}<input className={fieldClass} type="datetime-local" required value={draft.start} disabled={created} onChange={e=>update("start",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Einddatum en uur","End date and time","Fin","Ende")}<input className={fieldClass} type="datetime-local" required value={draft.end} disabled={created} onChange={e=>update("end",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Inschrijvingsdeadline","Registration deadline","Date limite d’inscription","Anmeldefrist")}<input className={fieldClass} type="datetime-local" required value={draft.deadline} disabled={created} onChange={e=>update("deadline",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Maximum aantal deelnemers","Maximum crew capacity","Capacité maximale","Maximale Teilnehmerzahl")}<input className={fieldClass} type="number" min="1" step="1" required value={draft.capacity} disabled={created} onChange={e=>update("capacity",e.target.value)}/></label>
   </div>
   {error&&<p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
   {!created&&<button type="submit" className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">{t(l,"EVENEMENT AANMAKEN","CREATE EVENT","CRÉER L’ÉVÉNEMENT","EVENT ERSTELLEN")}</button>}
  </form>
  {created&&<section className="space-y-3 rounded-2xl border border-violet-500/50 p-4"><p className="font-bold text-emerald-500">{t(l,"Fictief evenement aangemaakt","Fictional event created","Événement fictif créé","Fiktives Event erstellt")}</p><h2 className="text-xl font-bold">{draft.name}</h2><p className="text-sm">{draft.venue} · {draft.start.replace("T"," ")} — {draft.end.replace("T"," ")}</p><p className="text-sm">{t(l,"Capaciteit","Capacity","Capacité","Kapazität")}: {draft.capacity}</p><p className="text-sm">{t(l,"Deadline","Deadline","Date limite","Frist")}: {draft.deadline.replace("T"," ")}</p>{!published?<button data-tour-demo="primary-action" type="button" onClick={publish} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">{t(l,"EVENEMENT PUBLICER EN VERDERGAAN","PUBLISH EVENT AND CONTINUE","PUBLIER ET CONTINUER","EVENT VERÖFFENTLICHEN UND WEITER")}</button>:<p role="status" className="font-semibold text-emerald-500">{t(l,"Gepubliceerd in de demo. Open zelf Werkplekken & Shifts om verder te gaan.","Published in the demo. Open Workplaces & Shifts yourself to continue.","Publié dans la démo. Ouvrez vous-même Postes & Shifts.","In der Demo veröffentlicht. Öffne Arbeitsplätze & Schichten selbst.")}</p>}</section>}
  {created&&<section className="space-y-3 rounded-2xl border p-4"><h2 className="font-bold">{t(l,"Deelnemer toevoegen","Add participant","Ajouter un participant","Teilnehmer hinzufügen")}</h2><p className="text-sm">{t(l,"Voeg het gebruikers-ID toe van een bestaand staging-account.","Enter the user ID of an existing staging account.","Saisissez l’identifiant d’un compte staging existant.","Gib die Benutzer-ID eines bestehenden Staging-Kontos ein.")}</p><form className="space-y-2" onSubmit={async e=>{e.preventDefault();setParticipantMessage("");try{await addTrainingParticipant(participantId.trim());setParticipantId("");setParticipantMessage(t(l,"Deelnemer toegevoegd.","Participant added.","Participant ajouté.","Teilnehmer hinzugefügt."))}catch{setParticipantMessage(t(l,"Toevoegen mislukt. Controleer het ID en of het scenario is gesynchroniseerd.","Could not add participant. Check the ID and scenario sync.","Ajout impossible. Vérifiez l’identifiant et la synchronisation.","Hinzufügen fehlgeschlagen. Prüfe ID und Synchronisierung."))}}}><input aria-label={t(l,"Gebruikers-ID","User ID","Identifiant utilisateur","Benutzer-ID")} className={fieldClass} value={participantId} onChange={e=>setParticipantId(e.target.value)} placeholder={t(l,"Gebruikers-ID (UUID)","User ID (UUID)","Identifiant utilisateur (UUID)","Benutzer-ID (UUID)")} required pattern="[0-9a-fA-F-]{36}"/><button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white">{t(l,"TOEVOEGEN","ADD","AJOUTER","HINZUFÜGEN")}</button></form>{participantMessage&&<p role="status" className="text-sm">{participantMessage}</p>}</section>}
  {created&&<section className="space-y-3 rounded-2xl border p-4" data-tour-demo="training-progress-report">
   <h2 className="font-bold">{t(l,"Trainingsvoortgang personeel","Crew training progress","Progression de la formation","Trainingsfortschritt des Personals")}</h2>
   <p className="text-sm text-muted-foreground">{t(l,"Bekijk geverifieerde oefeningen en openstaande stappen per deelnemer. Alleen staginggegevens.","Review verified exercises and outstanding steps per participant. Staging data only.","Consultez les exercices vérifiés et les étapes restantes par participant. Données de test uniquement.","Prüfe bestätigte Übungen und offene Schritte je Teilnehmer. Nur Staging-Daten.")}</p>
   <button type="button" className="rounded-xl border border-violet-500 px-4 py-2 font-bold" onClick={async()=>{setReportMessage("");try{const id=await getOwnedTrainingScenarioId();setReports(await listTrainingProgressReports(id));setReportMessage(t(l,"Rapport bijgewerkt.","Report updated.","Rapport actualisé.","Bericht aktualisiert."))}catch{setReportMessage(t(l,"Rapport ophalen mislukt.","Could not load report.","Impossible de charger le rapport.","Bericht konnte nicht geladen werden."))}}}>{t(l,"RAPPORT VERNIEUWEN","REFRESH REPORT","ACTUALISER LE RAPPORT","BERICHT AKTUALISIEREN")}</button>
   {reportMessage&&<p role="status" className="text-sm">{reportMessage}</p>}
   {reports.map(report=><article key={report.participantId+report.role} className="rounded-xl border p-3 text-sm">
     <p className="font-semibold break-all">{report.participantId} · {report.role}</p>
     <p>{report.completed}/{report.total} · {report.canFinish?t(l,"Afgerond","Complete","Terminé","Abgeschlossen"):t(l,"Nog bezig","In progress","En cours","In Bearbeitung")}</p>
     {report.pending.length>0&&<details className="mt-2"><summary className="cursor-pointer font-semibold">{t(l,"Openstaande oefeningen","Pending exercises","Exercices restants","Offene Übungen")} ({report.pending.length})</summary><ul className="mt-2 list-disc pl-5">{report.pending.map(id=><li key={id}>{id}</li>)}</ul></details>}
     {report.failed.length>0&&<p className="mt-2 text-red-500">{t(l,"Oefeningen met fouten","Exercises with errors","Exercices avec erreurs","Übungen mit Fehlern")}: {report.failed.join(", ")}</p>}
   </article>)}
  </section>
  {created&&<section className="space-y-3 rounded-2xl border p-4"><button type="button" className="rounded-xl border px-4 py-2" onClick={async()=>{try{setScenarioId(await getOwnedTrainingScenarioId())}catch{setError(t(l,"Trainingsscenario niet gevonden.","Training scenario not found.","Scénario introuvable.","Trainingsszenario nicht gefunden."))}}}>{t(l,"Trainingsvragen openen","Open training questions","Ouvrir les questions","Trainingsfragen öffnen")}</button>{scenarioId&&<TrainingQuestionsPanel scenarioId={scenarioId} role="admin" isAdmin/>}</section>}
 </main>
}
