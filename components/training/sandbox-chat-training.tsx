"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Channel="organization"|"event"|"workplace"|"private"
type Message={id:number;channel:Channel;body:string;sender:string;time:string;replyTo?:number;attachment?:string}
type State={channel:Channel;peer:string;privateVisible:boolean;unread:number;participants:string[];messages:Message[];scanReviewed:boolean}
const STORAGE="uptilldawn-chat-training-v1:"
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const choices=[{value:"lina",name:"Lina Peeters"},{value:"noah",name:"Noah Jacobs"},{value:"mila",name:"Mila Vermeulen"}]
const initial=():State=>({
 channel:"event",peer:"lina",privateVisible:true,unread:2,participants:["lina","noah"],
 messages:[
  {id:1,channel:"event",body:"Welkom bij UpTillDawn Trainingsavond.",sender:"Lina Peeters",time:"19:40"},
  {id:2,channel:"workplace",body:"Bar / Toog: controleer de prijslijst en de voorraad.",sender:"Noah Jacobs",time:"19:45"},
  {id:3,channel:"organization",body:"De trainingslocatie is klaar voor alle crew.",sender:"Admin",time:"19:46"}
 ],scanReviewed:false
})
function saved(key:string):State{
 try{
  const parsed=JSON.parse(sessionStorage.getItem(key)||"null") as State|null
  if(parsed&&Array.isArray(parsed.messages)&&Array.isArray(parsed.participants)&&typeof parsed.unread==="number")return parsed
 }catch{}
 return initial()
}
export function SandboxChatTraining({role}:{role:string}){
 const normalized:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [state,setState]=useState<State>(initial)
 const [search,setSearch]=useState("")
 const [peer,setPeer]=useState("lina")
 const [draft,setDraft]=useState("")
 const [file,setFile]=useState("")
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const key=STORAGE+normalized
 const steps=useMemo(()=>getTrainingOperations(normalized,"chat"),[normalized])
 const current:PracticeOperation|undefined=steps.find(x=>x.id===currentId)
 const index=current?Number(current.id.split(":").at(-1)):0
 const isAdminStep=current?.id.startsWith("chat:admin:")
 const currentChannel=state.channel
 const messages=state.messages.filter(m=>m.channel===currentChannel)
 const lastEvent=state.messages.filter(m=>m.channel==="event").at(-1)
 const privateCount=state.messages.filter(m=>m.channel==="private").length
 const labels={
  organization:T(l,"Organisatie","Organisation","Organisation","Organisation"),
  event:T(l,"Evenement","Event","Événement","Event"),
  workplace:T(l,"Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"),
  private:T(l,"Privé · Lina","Private · Lina","Privé · Lina","Privat · Lina")
 }
 useEffect(()=>{
  const apply=()=>setL(activeUiLocale())
  apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply)
  return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)
 },[])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{setState(saved(key));setHydrated(true)})
  return()=>cancelAnimationFrame(frame)
 },[key])
 useEffect(()=>{
  // Keep the operational panel synchronized with the instructor's active
  // catalog step. A control for an earlier action cannot credit a later one.
  const sync=()=>{
   const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||""
   setCurrentId(previous=>previous===id?previous:id)
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 const save=(next:State)=>{setState(next);sessionStorage.setItem(key,JSON.stringify(next))}
 const record=(next:State,value:string)=>{
  if(!hydrated||!current||!value.trim())return
  if(current.kind==="message"&&value.trim().length<5)return
  save(next);setDraft("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{
   detail:{role:normalized,chapter:"chat",id:current.id,kind:current.kind,value}
  }))
 }
 const commit=()=>{
  if(!current)return
  const id=current.id
  const i=index
  let next={...state,messages:[...state.messages],participants:[...state.participants]}
  if(isAdminStep){
   if(i===1){next.participants=[...new Set([...next.participants,peer])];record(next,peer);return}
   if(i===2){
    if(draft.trim().length<5){setError(T(l,"Schrijf eerst een aankondiging.","Write an announcement first.","Rédigez d’abord une annonce.","Schreibe zuerst eine Ankündigung."));return}
    next.messages.push({id:Date.now(),channel:"organization",sender:"Admin",body:draft.trim(),time:"20:03"})
    record(next,draft.trim());return
   }
   record(next,"reviewed");return
  }
  if(i<=2){
   next.channel=(["organization","event","workplace"] as Channel[])[i]
   record(next,"reviewed");return
  }
  if(i===3){
   if(!choices.some(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()))||search.trim().length<2){
    setError(T(l,"Zoek een bestaande medewerker.","Search for an existing crew member.","Recherchez un membre existant.","Suche ein vorhandenes Teammitglied."));return
   }
   record(next,search.trim());return
  }
  if(i===4){next.peer=peer;record(next,peer);return}
  if([5,6,7,8].includes(i)){
   if(draft.trim().length<5){setError(T(l,"Voer minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Gib mindestens fünf Zeichen ein."));return}
   if(i===8&&!draft.includes("@Lina")){setError(T(l,"Gebruik @Lina in je bericht.","Mention @Lina in the message.","Mentionnez @Lina dans le message.","Erwähne @Lina in der Nachricht."));return}
   const target:Channel=i===5?"private":"event"
   next.channel=target;next.privateVisible=true
   next.messages.push({id:Date.now(),channel:target,sender:"Jij / You",body:draft.trim(),time:"20:02",...(i===7&&lastEvent?{replyTo:lastEvent.id}:{})})
   record(next,draft.trim());return
  }
  if(i===9){
   if(!file){setError(T(l,"Selecteer een fictieve bijlage.","Select a fictional attachment.","Choisissez une pièce jointe fictive.","Wähle einen fiktiven Anhang."));return}
   next.channel="event"
   next.messages.push({id:Date.now(),channel:"event",sender:"Jij / You",body:T(l,"Demo-bijlage","Demo attachment","Pièce jointe démo","Demo-Anhang"),time:"20:03",attachment:file})
   record(next,file);return
  }
  if(i===10){next.scanReviewed=true;record(next,"reviewed");return}
  if(i===12){next.unread=0;record(next,"confirmed");return}
  if(i===13){next.privateVisible=false;next.channel="event";record(next,"confirmed");return}
  record(next,current.kind==="toggle"?"confirmed":"reviewed")
 }
 const command=()=>{
  if(!current)return null
  if(current.kind==="write")return <label className="grid gap-2 text-sm font-semibold">{current.title[l]}<input data-demo-chat-search type="search" value={search} onChange={e=>{setSearch(e.target.value);setError("")}} placeholder="Lina" className="w-full rounded-lg border bg-background p-3"/></label>
  if(current.kind==="select")return <label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-chat-choice value={peer} onChange={e=>setPeer(e.target.value)} className="rounded-lg border bg-background p-3">{choices.map(p=><option key={p.value} value={p.value}>{p.name}</option>)}</select></label>
  if(current.kind==="message")return <label className="grid gap-2 text-sm font-semibold">{current.title[l]}<textarea data-demo-chat-composer value={draft} onChange={e=>{setDraft(e.target.value);setError("")}} rows={3} className="w-full rounded-lg border bg-background p-3" placeholder={current.id==="chat:shared:8"?"@Lina ...":T(l,"Schrijf je trainingsbericht","Write your training message","Rédigez votre message","Schreibe deine Trainingsnachricht")}/></label>
  if(current.kind==="upload")return <label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-chat-attachment value={file} onChange={e=>setFile(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Kies een demobestand","Choose a demo file","Choisir un fichier démo","Demo-Datei wählen")}</option><option value="training-briefing.pdf">training-briefing.pdf</option><option value="training-inventory.png">training-inventory.png</option></select></label>
  return <p className="text-sm text-muted-foreground">{current.help[l]}</p>
 }
 return <main data-tour-demo="training-screen" data-training-chat="true" className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-bold uppercase text-violet-500">{T(l,"Interactieve trainingschat · uitsluitend fictieve gegevens","Interactive training chat · fictional data only","Chat de formation interactif · données fictives","Interaktiver Trainingschat · nur fiktive Daten")}</p><h1 className="mt-1 text-2xl font-black">{T(l,"Chats","Chats","Chats","Chats")}</h1><p className="text-sm text-muted-foreground">{T(l,"Open gesprekken, zoek leden, stuur berichten en oefen moderatie. Geen enkel bericht bereikt echte gebruikers.","Open conversations, find crew, send messages and practise moderation. No message reaches real users.","Ouvrez des conversations, trouvez des équipiers et entraînez-vous. Aucun message n’atteint de vrais utilisateurs.","Öffne Chats, finde Teammitglieder und übe die Verwaltung. Keine Nachricht erreicht echte Nutzer.")}</p></header>
  <div className="grid gap-4 md:grid-cols-[210px_1fr]">
   <nav aria-label={T(l,"Demo-gesprekken","Demo conversations","Conversations démo","Demo-Gespräche")} className="space-y-2 rounded-xl border p-3">
    {(["organization","event","workplace","private"] as Channel[]).filter(channel=>channel!=="private"||state.privateVisible).map(channel=><button key={channel} type="button" onClick={()=>save({...state,channel})} className={"block w-full rounded-lg border p-3 text-left text-sm font-semibold "+(channel===currentChannel?"border-violet-500":"")}>{labels[channel]} {channel==="event"&&state.unread>0?<span className="ml-2 rounded-full border px-2">{state.unread}</span>:null}</button>)}
    {!state.privateVisible&&<p data-demo-chat-private-hidden className="text-xs text-muted-foreground">{T(l,"Privéchat verwijderd uit lijst; berichten blijven bewaard.","Private chat removed from list; messages retained.","Chat privé retiré de la liste ; messages conservés.","Privatchat aus Liste entfernt; Nachrichten bleiben gespeichert.")}</p>}
   </nav>
   <section className="space-y-3 rounded-xl border p-4">
    <h2 className="font-bold">{labels[currentChannel]}</h2>
    <div data-demo-chat-message-count={state.messages.length} className="min-h-32 space-y-3">
     {messages.map(message=><article key={message.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-2"><strong>{message.sender}</strong><time>{message.time}</time></div><p className="mt-2 whitespace-pre-wrap">{message.body}</p>{message.replyTo&&<p className="mt-1 text-xs text-muted-foreground">{T(l,"Antwoord op bericht","Reply to message","Réponse au message","Antwort auf Nachricht")} #{message.replyTo}</p>}{message.attachment&&<p className="mt-2 rounded-lg border p-2 text-xs">{message.attachment} · {T(l,"simulatie van achtergrondcontrole","background scan simulation","simulation d’analyse en arrière-plan","simulierte Hintergrundprüfung")}</p>}</article>)}
    </div>
    {current&&<section className="space-y-3 rounded-lg border border-violet-500/40 p-4" data-demo-chat-operation={current.id}><p className="text-xs font-bold uppercase text-violet-500">{T(l,"Nu uitvoeren in de demo","Perform now in demo","À effectuer dans la démo","Jetzt in Demo ausführen")}</p><h3 className="font-semibold">{current.title[l]}</h3>{command()}<button type="button" data-training-practical-op={current.id} disabled={!hydrated} onClick={commit} className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{current.title[l]}</button>{error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}</section>}
    {state.scanReviewed&&<p data-demo-chat-scan className="rounded-lg border p-3 text-xs">{T(l,"Demo: controleproces bekeken. Dit is geen echte malwarescan.","Demo: scan workflow reviewed. This is not a real malware scan.","Démo : processus de scan consulté, sans analyse réelle.","Demo: Scanablauf geprüft; kein echter Malware-Scan.")}</p>}
    <aside className="rounded-lg border p-3 text-xs text-muted-foreground">{T(l,"Eventchat: zichtbaar tot 3 dagen na afloop. Privéchats mogen uit de lijst verdwijnen, berichten worden niet verwijderd.","Event chat: visible for three days after close. A private chat can be hidden without deleting messages.","Chat événement : visible pendant 3 jours après clôture. Masquer un chat privé ne supprime aucun message.","Eventchat: drei Tage nach Ende sichtbar. Ein Privatchat kann ohne Nachrichtenverlust ausgeblendet werden.")}</aside>
    <p data-demo-chat-retained={privateCount} className="text-xs text-muted-foreground">{T(l,"Bewaarde privéberichten","Retained private messages","Messages privés conservés","Gespeicherte Privatnachrichten")}: {privateCount}</p>
   </section>
  </div>
 </main>
}
