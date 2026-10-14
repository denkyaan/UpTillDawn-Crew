"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"
type RecordState={eventTitle:string;workplaceTitle:string;safety:string;checklist:string;workplace:string;attachments:string[];notices:string[];acknowledged:boolean;teamConfirmed:boolean;reviewed:string[];audit:string[]}
const initial=():RecordState=>({eventTitle:"",workplaceTitle:"",safety:"",checklist:"",workplace:"bar",attachments:[],notices:[],acknowledged:false,teamConfirmed:false,reviewed:[],audit:[]})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(role:TourRole)=>"uptilldawn-briefing-training-v1:"+role
const load=(role:TourRole)=>{try{const v=JSON.parse(sessionStorage.getItem(key(role))||"null") as RecordState|null;if(v&&Array.isArray(v.audit)&&Array.isArray(v.reviewed))return v}catch{}return initial()}
export function SandboxBriefingManagementTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [id,setId]=useState("")
 const [opened,setOpened]=useState(false)
 const [draft,setDraft]=useState("")
 const [selection,setSelection]=useState("")
 const [file,setFile]=useState("")
 const [data,setData]=useState<RecordState>(initial)
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const ops=useMemo(()=>getTrainingOperations(trainingRole,"briefings"),[trainingRole])
 const step:PracticeOperation|undefined=ops.find(o=>o.id===id)
 const group=step?.id.split(":")[1]
 const index=step?Number(step.id.split(":").at(-1)):-1
 const dedicated=trainingRole!=="admin"&&group==="shared"&&index>=0&&index<=5||trainingRole==="admin"&&id==="briefings:admin:0"
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setData(load(trainingRole));setReady(true)});return()=>cancelAnimationFrame(raf)},[trainingRole])
 useEffect(()=>{const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(old=>old===id?old:id)};sync();const o=new MutationObserver(sync);o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>o.disconnect()},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setOpened(false);setDraft("");setSelection("");setFile("");setError("")});return()=>cancelAnimationFrame(raf)},[id])
 const info=()=>{
  if(group==="shared"){
   if(index===0)return T(l,"Open de briefing voor UpTillDawn Trainingsavond en Main Bar.","Open the briefing for UpTillDawn Training Night and Main Bar.","Ouvrez le briefing de la Soirée UpTillDawn et du Bar principal.","Öffne das Briefing für UpTillDawn Trainingsabend und Hauptbar.")
   if(index===1)return T(l,"Veiligheid: nooduitgangen vrijhouden, EHBO lokaliseren, incidenten meteen melden.","Safety: keep exits clear, locate first aid, report incidents promptly.","Sécurité : dégager les sorties, trouver les secours et signaler les incidents.","Sicherheit: Ausgänge freihalten, Erste Hilfe kennen, Vorfälle sofort melden.")
   if(index===2)return T(l,"Bar/Toog: prijzen, kassalade, koeling, tokens en wisselgeld controleren.","Bar/Counter: review prices, till, cooling, tokens and change.","Bar/Comptoir : contrôler prix, caisse, frigos, jetons et monnaie.","Bar/Theke: Preise, Kasse, Kühlung, Tokens und Wechselgeld prüfen.")
   if(index===3)return T(l,"Opening: koeling aan, wisselgeld tellen, prijslijst plaatsen, EHBO controleren.","Opening: start cooling, count change, display prices and check first aid.","Ouverture : démarrer frigos, compter monnaie, afficher tarifs et vérifier secours.","Öffnung: Kühlung starten, Wechselgeld zählen, Preise anbringen, Erste Hilfe prüfen.")
   if(index===4)return T(l,"Sluiting: omzet afsluiten, geld veilig bewaren, inventaris nalopen, tekorten noteren.","Closing: reconcile sales, secure cash, inspect inventory, record shortages.","Fermeture : clôturer ventes, sécuriser argent, vérifier stock et manques.","Schluss: Umsatz abschließen, Bargeld sichern, Inventar und Engpässe prüfen.")
   if(index===6)return T(l,"Taken: voorraad aanvullen en tweede kassalade controleren.","Tasks: replenish stock and review second till.","Tâches : réapprovisionner et vérifier la deuxième caisse.","Aufgaben: Bestand auffüllen und zweite Kasse prüfen.")
   if(index===7)return T(l,"Briefing v2: EHBO-locatie bijgewerkt; medewerkers moeten de wijziging opnieuw lezen.","Briefing v2: first-aid location updated; staff must review the revision.","Briefing v2 : localisation des secours modifiée ; le personnel doit relire.","Briefing v2: Erste-Hilfe-Ort geändert; Personal muss Aktualisierung erneut lesen.")
  }
  if(group==="admin"&&index===6)return T(l,"3 van de 4 medewerkers hebben de werkplekbriefing gelezen.","3 of 4 workers have acknowledged the workplace briefing.","3 salariés sur 4 ont confirmé le briefing.","3 von 4 Mitarbeitenden haben das Briefing bestätigt.")
  if(group==="responsible_lead"&&index===3)return T(l,"Main Bar: 3/4 bevestigd. Noah moet de gewijzigde veiligheidsinstructie nog lezen.","Main Bar: 3/4 confirmed. Noah must still review updated safety instructions.","Bar principal : 3/4 confirmés. Noah doit encore lire la mise à jour.","Hauptbar: 3/4 bestätigt. Noah muss den Sicherheitshinweis noch lesen.")
  return T(l,"Persoonlijke shiftbriefing met instructies, opening en sluiting.","Personal shift briefing with opening and closing procedures.","Briefing du shift avec consignes d’ouverture et fermeture.","Schichtbriefing mit Start- und Schlussanweisungen.")
 }
 const submit=()=>{
  if(!step||!ready||dedicated)return
  let result=step.kind==="inspect"?"reviewed":"confirmed"
  const next:RecordState={...data,attachments:[...data.attachments],notices:[...data.notices],reviewed:[...data.reviewed],audit:[...data.audit]}
  const fail=(nl:string,en:string,fr:string,de:string)=>setError(T(l,nl,en,fr,de))
  if(step.kind==="inspect"){
   if(!opened)return
   next.reviewed=[...new Set([...next.reviewed,id])]
  }else if(step.kind==="form"||step.kind==="write"||step.kind==="message"){
   if(draft.trim().length<5)return fail("Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben.")
   result=draft.trim()
   if(group==="admin"&&index===1||group==="responsible_lead"&&index===0){next.workplaceTitle=result;result+=" · Main Bar"}
   if(group==="admin"&&index===2)next.safety=result
   if(group==="admin"&&index===3||group==="responsible_lead"&&index===1)next.checklist=result
   if(group==="admin"&&index===7||group==="responsible_lead"&&index===4)next.notices.push(result)
  }else if(step.kind==="select"){
   if(!selection)return fail("Kies een werkplek.","Select a workplace.","Choisissez un poste.","Wähle einen Arbeitsplatz.")
   result=selection;next.workplace=selection
  }else if(step.kind==="upload"){
   if(!file)return fail("Kies een voorbeeldbestand.","Choose a sample file.","Choisissez un fichier.","Wähle eine Beispieldatei.")
   result=file;next.attachments.push(file)
  }else if(step.kind==="toggle"){
   if(group==="shared"&&index===5){
    const sections=[0,1,2,3,4]
    if(!sections.every(x=>next.reviewed.includes("briefings:shared:"+x)))return fail("Open en lees eerst alle vijf briefingonderdelen.","Open and read all five briefing sections first.","Ouvrez et lisez d’abord les cinq sections.","Öffne und lies zuerst alle fünf Briefingabschnitte.")
    next.acknowledged=true
   }
   if(group==="responsible_lead"&&index===2||group==="employee"&&index===1)next.teamConfirmed=true
  }else return
  next.audit.push(id+" · "+result)
  sessionStorage.setItem(key(trainingRole),JSON.stringify(next));setData(next);setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"briefings",id,kind:step.kind,value:result}}))
 }
 if(!step||dedicated)return null
 return <section data-training-briefing-management={trainingRole} className="mx-auto my-4 max-w-6xl space-y-4 rounded-2xl border border-violet-500/50 p-4">
  <header><p className="text-xs font-black text-violet-500">{T(l,"BRIEFINGPRAKTIJK · GEÏSOLEERDE DEMO","BRIEFING PRACTICE · ISOLATED DEMO","PRATIQUE BRIEFING · DÉMO ISOLÉE","BRIEFING-PRAXIS · ISOLIERTE DEMO")}</p><h2 className="text-xl font-black">{T(l,"Briefings en bevestigingen","Briefings and acknowledgments","Briefings et confirmations","Briefings und Bestätigungen")}</h2></header>
  <article className="space-y-1 rounded-xl border p-3"><p>{T(l,"Werkplek","Workplace","Poste","Arbeitsplatz")}: {data.workplace}</p><p>{T(l,"Briefing","Briefing","Briefing","Briefing")}: {data.workplaceTitle||T(l,"Main Bar-shiftbriefing","Main Bar shift briefing","Briefing du Bar principal","Hauptbar-Schichtbriefing")}</p><p>{T(l,"Checklist","Checklist","Checklist","Checkliste")}: {data.checklist||T(l,"Koeling, EHBO en kassa","Cooling, first aid and till","Réfrigération, secours et caisse","Kühlung, Erste Hilfe und Kasse")}</p><p>{T(l,"Bijlagen","Attachments","Pièces jointes","Anhänge")}: {data.attachments.length} · {T(l,"Herinneringen","Reminders","Rappels","Erinnerungen")}: {data.notices.length}</p>{data.acknowledged&&<p>{T(l,"Briefing bevestigd","Briefing acknowledged","Briefing confirmé","Briefing bestätigt")}</p>}</article>
  <div data-demo-briefing-operation={id} className="space-y-3 rounded-xl border border-violet-500/40 p-3"><h3 className="font-bold">{step.title[l]}</h3>
  {step.kind==="inspect"?<><button type="button" data-training-preview-op={id} onClick={()=>setOpened(true)} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white">{T(l,"OPEN BRIEFINGONDERDEEL","OPEN BRIEFING SECTION","OUVRIR SECTION","BRIEFINGABSCHNITT ÖFFNEN")}</button>{opened&&<p data-demo-briefing-detail={id} className="rounded-lg border p-3 text-sm">{info()}</p>}</>
   :step.kind==="form"||step.kind==="write"||step.kind==="message"?<label className="grid gap-2 text-sm font-semibold">{step.title[l]}<textarea data-demo-briefing-input rows={3} value={draft} onChange={e=>setDraft(e.target.value)} className="rounded-xl border bg-background p-3"/></label>
   :step.kind==="select"?<label className="grid gap-2 text-sm font-semibold">{step.title[l]}<select data-demo-briefing-select value={selection} onChange={e=>setSelection(e.target.value)} className="rounded-xl border bg-background p-3"><option value="">{T(l,"Kies","Choose","Choisir","Wählen")}</option><option value="bar">{T(l,"Main Bar / Toog","Main Bar / Counter","Bar principal / Comptoir","Hauptbar / Theke")}</option><option value="tokens">{T(l,"Tokens","Tokens","Jetons","Tokens")}</option></select></label>
   :step.kind==="upload"?<label className="grid gap-2 text-sm font-semibold">{step.title[l]}<select data-demo-briefing-file value={file} onChange={e=>setFile(e.target.value)} className="rounded-xl border bg-background p-3"><option value="">{T(l,"Kies demo-bijlage","Choose demo attachment","Choisir pièce jointe","Demoanhang wählen")}</option><option value="training-briefing.pdf">{T(l,"training-briefing.pdf","training-briefing.pdf","training-briefing.pdf","training-briefing.pdf")}</option></select></label>
   :<p className="text-sm">{step.help[l]}</p>}
   <button type="button" data-training-practical-op={id} disabled={!ready||(step.kind==="inspect"&&!opened)} onClick={submit} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{step.title[l]}</button>
   {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  </div>
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Controlelog","Audit trail","Journal","Protokoll")} · {data.audit.length}</summary><ol data-demo-briefing-audit-count={data.audit.length} className="mt-2 space-y-1 text-sm">{data.audit.map((row,i)=><li key={i}>{row}</li>)}</ol></details>
 </section>
}
