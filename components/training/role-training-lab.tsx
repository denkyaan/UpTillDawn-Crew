"use client"

import {useEffect,useMemo,useRef,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,practiceDoneKey,readPracticeLedger,isChapterPractised,type PracticeOperation,type PracticeLedger} from "@/lib/training-exercise-catalog"
import {TOUR_CHAPTERS,type TourRole,type TourCopy} from "@/lib/tour-training"

const c=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
function optionsFor(step:PracticeOperation):{value:string;label:TourCopy}[]{
 const name=step.title.nl.toLowerCase()
 const item=(value:string,nl:string,en:string,fr:string,de:string)=>({value,label:{nl,en,fr,de}})
 if(/taal/.test(name))return [item("nl","Nederlands","Dutch","Néerlandais","Niederländisch"),item("fr","Frans","French","Français","Französisch"),item("en","Engels","English","Anglais","Englisch"),item("de","Duits","German","Allemand","Deutsch")]
 if(/rol/.test(name))return [item("employee","Personeel","Staff","Personnel","Personal"),item("responsible_lead","Verantwoordelijke","Responsible lead","Responsable","Verantwortlich"),item("admin","Admin","Admin","Admin","Admin")]
 if(/urgentie/.test(name))return [item("normal","Normaal","Normal","Normal","Normal"),item("urgent","Dringend","Urgent","Urgent","Dringend"),item("critical","Kritiek","Critical","Critique","Kritisch")]
 if(/formaat/.test(name))return [item("xlsx","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)"),item("csv","CSV","CSV","CSV","CSV"),item("pdf","PDF","PDF","PDF","PDF")]
 if(/incidentcategorie/.test(name))return [item("technical","Technisch","Technical","Technique","Technisch"),item("safety","Veiligheid","Safety","Sécurité","Sicherheit"),item("other","Overige","Other","Autre","Sonstige")]
 if(/status|prioriteit/.test(name))return [item("planned","Gepland","Scheduled","Planifié","Geplant"),item("active","Actief","Active","Actif","Aktiv"),item("done","Afgesloten","Closed","Clôturé","Abgeschlossen")]
 if(/medewerker|persone|persoon|deelnemer/.test(name))return [item("lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"),item("noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"),item("mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen")]
 if(/beschikbaar|opbouw|afbouw/.test(name))return [item("yes","Ik kan","I can","Je peux","Ich kann"),item("no","Ik kan niet","I cannot","Je ne peux pas","Ich kann nicht")]
 if(/overtime/.test(name))return [item("daily","Dagelijks","Daily","Journalier","Täglich"),item("weekly","Wekelijks","Weekly","Hebdomadaire","Wöchentlich")]
 return [item("bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"),item("merch","Merch","Merch","Merch","Merch"),item("tokens","Tokens","Tokens","Jetons","Tokens"),item("entrance","Inkom & Guestlist","Entrance & Guestlist","Entrée & Guestlist","Eingang & Gästeliste"),item("backstage","Backstage Management","Backstage Management","Gestion des coulisses","Backstage Management"),item("driver","Driver","Driver","Chauffeur","Fahrer")]
}
function getDemoState(key:string):Record<string,string>{
 try{const raw=JSON.parse(sessionStorage.getItem("uptilldawn-lab-model:"+key)||"{}");return raw&&typeof raw==="object"?raw:{}}catch{return {}}
}
function recordDemoState(key:string,id:string,value:string){
 const data=getDemoState(key)
 sessionStorage.setItem("uptilldawn-lab-model:"+key,JSON.stringify({...data,[id]:value}))
 dispatchEvent(new CustomEvent("uptilldawn-training-demo-updated",{detail:{id,value}}))
}
export function RoleTrainingLab({role,chapter,progressKey}:{role:TourRole;chapter:string;progressKey:string}){
 const operations=useMemo(()=>getTrainingOperations(role,chapter),[role,chapter])
 const [language,setLanguage]=useState<SupportedUiLocale>("nl")
 const [ledger,setLedger]=useState<PracticeLedger>({})
 const [hydrated,setHydrated]=useState(false)
 const [opened,setOpened]=useState(false)
 const [textValue,setTextValue]=useState("")
 const [selected,setSelected]=useState("")
 const [acknowledged,setAcknowledged]=useState(false)
 const [firstTime,setFirstTime]=useState("")
 const [secondTime,setSecondTime]=useState("")
 const [fileName,setFileName]=useState("")
 const [error,setError]=useState("")
 const [reviewed,setReviewed]=useState(false)
 const lastCompletion=useRef("")
 const container=useRef<HTMLElement|null>(null)
 const chapterData=TOUR_CHAPTERS.find(item=>item.key===chapter)
 const currentIndex=operations.findIndex(step=>!ledger[step.id]?.value)
 const index=currentIndex<0?operations.length:currentIndex
 const current=operations[index]
 const complete=operations.length>0&&operations.every(step=>Boolean(ledger[step.id]?.value))
 const options=current?optionsFor(current):[]
 useEffect(()=>{const apply=()=>setLanguage(activeUiLocale());const frame=requestAnimationFrame(apply);addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>{cancelAnimationFrame(frame);removeEventListener(LANGUAGE_APPLIED_EVENT,apply)}},[])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
   setLedger(readPracticeLedger(progressKey))
   setHydrated(true);setOpened(false);setTextValue("");setSelected("");setAcknowledged(false)
   setFirstTime("");setSecondTime("");setFileName("");setError("");setReviewed(false)
  })
  return()=>cancelAnimationFrame(frame)
 },[progressKey,role,chapter])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
   setOpened(false);setTextValue("");setSelected("");setAcknowledged(false)
   setFirstTime("");setSecondTime("");setFileName("");setError("");setReviewed(false)
  })
  return()=>cancelAnimationFrame(frame)
 },[current?.id])
 useEffect(()=>{
  if(!hydrated||!complete||!isChapterPractised(progressKey,role,chapter))return
  const marker=progressKey+":"+chapter
  if(lastCompletion.current===marker)return
  lastCompletion.current=marker
  const frame=requestAnimationFrame(()=>dispatchEvent(new CustomEvent("uptilldawn-training-lab-completed",{detail:{role,chapter}})))
  return()=>cancelAnimationFrame(frame)
 },[chapter,complete,hydrated,progressKey,role])
 const execute=()=>{
  if(!current||!hydrated)return
  let value=""
  switch(current.kind){
   case "inspect":
    if(!opened){setError(c(language,"Open eerst de informatie.","First open the information.","Ouvrez d’abord les informations.","Öffne zuerst die Informationen."));return}
    value="reviewed";break
   case "write":case "message":
    if(textValue.trim().length<5){setError(c(language,"Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben."));return}
    value=textValue.trim();break
   case "delete":
    if(textValue.trim()!=="DEMO"){setError(c(language,"Typ DEMO om veilig te bevestigen.","Type DEMO to confirm safely.","Saisissez DEMO pour confirmer.","Gib DEMO zur sicheren Bestätigung ein."));return}
    value="demo-deletion-reviewed";break
   case "form":
    if(textValue.trim().length<5||!selected){setError(c(language,"Vul de naam in en kies een categorie.","Enter a name and select a category.","Saisissez un nom et choisissez une catégorie.","Name eingeben und Kategorie wählen."));return}
    value=textValue.trim()+" · "+selected;break
   case "select":
    if(!selected){setError(c(language,"Maak eerst een keuze.","Choose an option first.","Choisissez une option.","Bitte zuerst auswählen."));return}
    value=selected;break
   case "number":
    if(!Number.isFinite(Number(textValue))||Number(textValue)<=0){setError(c(language,"Voer een positief aantal in.","Enter a positive number.","Saisissez un nombre positif.","Positive Zahl eingeben."));return}
    value=String(Number(textValue));break
   case "schedule":
    if(!firstTime||!secondTime||firstTime>=secondTime){setError(c(language,"Kies een geldig begin en einde.","Choose a valid start and end.","Choisissez un début et une fin valides.","Gültigen Beginn und Ende wählen."));return}
    value=firstTime+" → "+secondTime;break
   case "upload":
    if(!fileName){setError(c(language,"Kies een demobestand of eigen voorbeeldbestand.","Choose a demo file or your own sample.","Choisissez un fichier démo ou personnel.","Wähle eine Demo-Datei oder eigene Beispieldatei."));return}
    value=fileName;break
   case "toggle":
    if(!acknowledged){setError(c(language,"Bevestig de handeling zelf.","Confirm the action yourself.","Confirmez vous-même l’action.","Bestätige die Handlung selbst."));return}
    value="confirmed";break
  }
  if(!value)return
  const entry={value,at:new Date().toISOString(),kind:current.kind}
  const next={...ledger,[current.id]:entry}
  localStorage.setItem(practiceDoneKey(progressKey),JSON.stringify(next))
  recordDemoState(progressKey,current.id,value)
  setLedger(next)
  setError("")
  requestAnimationFrame(()=>container.current?.scrollIntoView({behavior:"smooth",block:"start"}))
 }
 const resetAll=()=>{
  // A restart is explicit; individual completed actions cannot be skipped.
  localStorage.removeItem(practiceDoneKey(progressKey))
  sessionStorage.removeItem("uptilldawn-lab-model:"+progressKey)
  lastCompletion.current=""
  setLedger({})
 }
 if(!hydrated)return null
 return <section ref={container} data-no-translate data-training-lab data-training-chapter={chapter} aria-label={c(language,"Praktische rolopleiding","Practical role training","Formation pratique par rôle","Praktisches Rollentraining")} className="mx-auto my-6 w-full max-w-5xl scroll-mt-24 rounded-2xl border border-violet-500/50 bg-card p-4 shadow-sm sm:p-6">
  <header className="space-y-2">
   <p className="text-xs font-black uppercase tracking-wider text-violet-500">{c(language,"VERPLICHTE PRAKTIJKTRAINING · FICTIEVE GEGEVENS","MANDATORY HANDS-ON TRAINING · FICTIONAL DATA","FORMATION PRATIQUE OBLIGATOIRE · DONNÉES FICTIVES","VERPFLICHTENDES PRAXISTRAINING · FIKTIVE DATEN")}</p>
   <h2 className="text-xl font-black">{chapterData?.title[language]||chapter}</h2>
   <p className="text-sm text-muted-foreground">{chapterData?.description[language]}</p>
   <div className="flex items-center gap-3 text-xs font-bold"><span>{Math.min(index,operations.length)} / {operations.length} {c(language,"handelingen uitgevoerd","actions completed","actions réalisées","Handlungen erledigt")}</span><progress className="h-2 flex-1 accent-violet-600" value={index} max={Math.max(1,operations.length)}/></div>
  </header>
  {current?<div className="mt-5 space-y-4 rounded-xl border p-4">
   <p className="text-xs font-bold text-violet-500">{c(language,"ACTIEVE HANDELING","ACTIVE ACTION","ACTION ACTIVE","AKTIVE HANDLUNG")} {index+1}/{operations.length}</p>
   <h3 className="text-lg font-black">{current.title[language]}</h3>
   <p className="text-sm leading-6 text-muted-foreground">{current.help[language]}</p>
   {current.kind==="inspect"&&<div className="space-y-3">
     <button type="button" data-training-active-action={!opened?"true":undefined} onClick={()=>{setOpened(true);setReviewed(true);setError("")}} className="rounded-xl border px-4 py-3 text-sm font-bold">{c(language,"OPEN DEMO-INFORMATIE","OPEN DEMO INFORMATION","OUVRIR LES INFORMATIONS DÉMO","DEMO-INFORMATIONEN ÖFFNEN")}</button>
     {opened&&<article className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm leading-6"><p className="font-bold">{current.title[language]}</p><p>{current.help[language]}</p><p className="mt-2 text-muted-foreground">{c(language,"Demogegevens: UpTillDawn Trainingsavond · Main Bar · Lina Peeters · 20:00–04:00. Dit voorbeeld verandert geen productiegegevens.","Demo data: UpTillDawn Training Night · Main Bar · Lina Peeters · 20:00–04:00. This sample changes no production data.","Données démo : Soirée d’entraînement UpTillDawn · Bar principal · Lina Peeters · 20:00–04:00. Aucun changement en production.","Demo-Daten: UpTillDawn Trainingsabend · Main Bar · Lina Peeters · 20:00–04:00. Keine Änderung der Produktionsdaten.")}</p></article>}
     {reviewed&&<button type="button" data-training-active-action onClick={execute} className="rounded-xl border px-4 py-3 text-sm font-black">{c(language,"IK HEB DIT GECONTROLEERD","I HAVE REVIEWED THIS","J’AI VÉRIFIÉ","ICH HABE DIES GEPRÜFT")}</button>}
    </div>}
   {(current.kind==="write"||current.kind==="number"||current.kind==="delete"||current.kind==="form")&&<div className="grid gap-3">
     <label className="grid gap-1 text-sm font-bold">{current.kind==="number"?c(language,"Aantal of bedrag","Quantity or amount","Quantité ou montant","Anzahl oder Betrag"):current.kind==="delete"?c(language,"Typ DEMO (geen echte verwijdering)","Type DEMO (no real deletion)","Saisissez DEMO (sans suppression réelle)","DEMO eingeben (keine echte Löschung)"):c(language,"Voer een fictieve waarde in","Enter fictional value","Saisissez une valeur fictive","Fiktiven Wert eingeben")}
      <input data-training-active-action={!textValue?"true":undefined} type={current.kind==="number"?"number":"text"} min={current.kind==="number"?1:undefined} value={textValue} onChange={event=>{setTextValue(event.target.value);setError("")}} className="w-full rounded-lg border bg-background px-3 py-2 text-foreground" placeholder={current.kind==="number"?"12":current.kind==="delete"?"DEMO":"UpTillDawn Trainingsavond"}/>
     </label>
     {current.kind==="form"&&<label className="grid gap-1 text-sm font-bold">{c(language,"Koppel een categorie of werkplek","Link category or workplace","Associer catégorie ou poste","Kategorie oder Arbeitsplatz zuordnen")}<select data-training-active-action={!selected?"true":undefined} value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{c(language,"Maak een keuze","Choose an option","Choisissez une option","Option wählen")}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label[language]}</option>)}</select></label>}
    </div>}
   {current.kind==="message"&&<label className="grid gap-2 text-sm font-bold">{c(language,"Berichtinhoud (alleen in de demo)","Message content (demo only)","Contenu du message (démo uniquement)","Nachrichteninhalt (nur Demo)")}<textarea data-training-active-action={!textValue?"true":undefined} rows={3} value={textValue} onChange={e=>{setTextValue(e.target.value);setError("")}} className="w-full rounded-lg border bg-background p-3" placeholder={c(language,"Voer een concreet trainingsbericht in...","Type a real training example...","Saisissez un exemple de message...","Konkrete Trainingsnachricht eingeben...")}/></label>}
   {current.kind==="select"&&<label className="grid gap-2 text-sm font-bold">{c(language,"Selecteer een optie","Select an option","Sélectionnez une option","Option auswählen")}<select data-training-active-action={!selected?"true":undefined} value={selected} onChange={e=>{setSelected(e.target.value);setError("")}} className="w-full rounded-lg border bg-background p-3"><option value="">{c(language,"Maak een keuze","Choose an option","Choisissez une option","Option wählen")}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label[language]}</option>)}</select></label>}
   {current.kind==="toggle"&&<label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold"><input data-training-active-action={!acknowledged?"true":undefined} type="checkbox" checked={acknowledged} onChange={event=>{setAcknowledged(event.target.checked);setError("")}} className="size-5 accent-violet-600"/>{current.title[language]}</label>}
   {current.kind==="schedule"&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0,1].map((n)=><label key={n} className="grid gap-1 text-sm font-bold">{n===0?c(language,"Begin","Start","Début","Beginn"):c(language,"Einde","End","Fin","Ende")}<input data-training-active-action={!(n===0?firstTime:secondTime)?"true":undefined} type="datetime-local" value={n===0?firstTime:secondTime} onChange={event=>{(n===0?setFirstTime:setSecondTime)(event.target.value);setError("")}} className="w-full rounded-lg border bg-background p-3"/></label>)}</div>}
   {current.kind==="upload"&&<div className="grid gap-3"><label className="grid gap-1 text-sm font-bold">{c(language,"Selecteer een demobestand","Select a demo file","Choisir un fichier démo","Demo-Datei auswählen")}<select data-training-active-action={!fileName?"true":undefined} value={fileName} onChange={event=>{setFileName(event.target.value);setError("")}} className="rounded-lg border bg-background p-3"><option value="">{c(language,"Kies een voorbeeld","Select an example","Choisir un exemple","Beispiel wählen")}</option><option value="training-briefing.pdf">training-briefing.pdf</option><option value="training-prices.csv">training-prices.csv</option><option value="training-inventory.png">training-inventory.png</option></select></label><label className="grid gap-1 text-xs text-muted-foreground">{c(language,"Of kies een eigen bestand (wordt niet geüpload)","Or select your own file (not uploaded)","Ou sélectionnez un fichier personnel (non téléversé)","Oder eigene Datei wählen (wird nicht hochgeladen)")}<input type="file" onChange={event=>setFileName(event.target.files?.[0]?.name||"")} className="w-full rounded-lg border bg-background p-2 text-foreground"/></label></div>}
   {current.kind!=="inspect"&&<button type="button" data-training-active-action={!error?"true":undefined} onClick={execute} className="rounded-xl border px-4 py-3 text-sm font-black">{c(language,"UITVOEREN IN DE DEMO","PERFORM IN DEMO","EXÉCUTER DANS LA DÉMO","IN DEMO AUSFÜHREN")}</button>}
   {error&&<p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-500">{error}</p>}
  </div>:<div role="status" className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"><h3 className="font-black text-emerald-600">{c(language,"Alle handelingen in dit hoofdstuk uitgevoerd","All chapter actions completed","Toutes les actions du chapitre sont terminées","Alle Kapitelhandlungen abgeschlossen")}</h3><p className="mt-2 text-sm">{c(language,"Open nu zelf de volgende aangeduide tab. Niets werd automatisch uitgevoerd.","Now open the indicated next tab yourself. No actions were performed automatically.","Ouvrez vous-même l’onglet suivant. Aucune action automatique.","Öffne nun selbst den markierten nächsten Tab. Keine automatischen Aktionen.")}</p></div>}
  <details className="mt-5 rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-bold">{c(language,"Overzicht uitgevoerde handelingen","Completed action log","Journal des actions effectuées","Protokoll ausgeführter Aktionen")}</summary><ol className="mt-3 max-h-60 space-y-2 overflow-y-auto">{operations.filter(step=>ledger[step.id]?.value).map(step=><li key={step.id} className="flex items-start justify-between gap-3 rounded-lg border p-2"><span>{step.title[language]}</span><span className="text-emerald-600">✓</span></li>)}</ol></details>
  {complete&&<button type="button" onClick={resetAll} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">{c(language,"OEFENINGEN OPNIEUW UITVOEREN","REPEAT EXERCISES","RECOMMENCER LES EXERCICES","ÜBUNGEN WIEDERHOLEN")}</button>}
 </section>
}
