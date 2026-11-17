"use client"

import {useEffect,useMemo,useState} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {createClient} from "@/lib/supabase/crew-client"
import {TaskControls} from "@/components/crew/task-controls"
import {completeOperationalChecklistItem,reopenOperationalChecklistItem,requestInventorySettlement,cancelInventorySettlement} from "@/lib/actions/uptilldawn"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

type Task={id:string;user_id:string;status:string;confirmed_at:string|null;tasks:{id:string;title:string;description:string|null;event_id:string|null;workplace_id:string|null}|null}
type Checklist={id:string;event_id:string;workplace_id:string|null;title:string;description:string|null;kind:string;status:string}
type Item={id:string;checklist_id:string;label:string;required:boolean;requires_photo:boolean;completed_at:string|null;completed_by:string|null;photo_path:string|null}
type Issue={id:string;item_id:string;user_id:string;quantity:number;outstanding_quantity:number;issued_at:string;notes:string|null}
type Request={id:string;issue_id:string;status:string;condition:string;quantity:number;notes:string|null;decision_note:string|null;user_id:string}
type Movement={id:string;item_id:string;movement_type:string;notes:string|null;created_at:string;quantity:number}
type Inventory={id:string;name:string}
type Attachment={id:string;task_id:string;storage_path:string;mime_type:string|null}
const translations={
 nl:{title:"Taken",loading:"Taken en werkmateriaal laden…",failed:"Taken konden niet worden geladen.",retry:"Opnieuw proberen",wait:"Taken zijn beschikbaar vanaf de start van je toegewezen shift.",noTasks:"Geen toegewezen taken.",confirm:"Wacht op bevestiging",check:"Operationele checklists",noCheck:"Geen checklists beschikbaar.",done:"KLAAR",open:"OPEN",complete:"PUNT VOLTOOIEN",reopen:"PUNT HEROPENEN",required:"VERPLICHT",photo:"FOTO VERPLICHT",proof:"Bekijk bewijsfoto",material:"Mijn materiaal",noMaterial:"Er staat momenteel geen materiaal op jouw naam.",outstanding:"Uitstaand",pending:"Melding wacht op controle",cancel:"MELDING ANNULEREN",note:"Notitie (optioneel)",quantity:"Aantal verwerken",returned:"RETOUR MELDEN",damaged:"BESCHADIGD MELDEN",missing:"VERMIST MELDEN",history:"Recente materiaalmeldingen",movements:"Recente materiaalmutaties",submitError:"Wijziging kon niet worden opgeslagen.",stateError:"Huidige status is tijdelijk niet beschikbaar.",attachments:"Bijlagen",openFile:"OPENEN",filePending:"Bijlage wacht op veiligheidscontrole",waiting:"Wacht op bevestiging",confirmed:"Bevestigd",event:"Evenement",workplace:"Werkplek",reload:"Vernieuwen"},
 fr:{title:"Tâches",loading:"Chargement des tâches et du matériel…",failed:"Impossible de charger les tâches.",retry:"Réessayer",wait:"Les tâches sont disponibles à partir du début de votre service.",noTasks:"Aucune tâche assignée.",confirm:"En attente de confirmation",check:"Checklists opérationnelles",noCheck:"Aucune checklist disponible.",done:"TERMINÉ",open:"OUVERT",complete:"TERMINER LE POINT",reopen:"ROUVRIR LE POINT",required:"OBLIGATOIRE",photo:"PHOTO OBLIGATOIRE",proof:"Voir la photo",material:"Mon matériel",noMaterial:"Aucun matériel à votre nom.",outstanding:"En attente",pending:"Déclaration en attente de validation",cancel:"ANNULER LA DÉCLARATION",note:"Note (facultatif)",quantity:"Quantité à traiter",returned:"SIGNALER UN RETOUR",damaged:"SIGNALER UN DOMMAGE",missing:"SIGNALER UNE PERTE",history:"Déclarations récentes",movements:"Mouvements récents",submitError:"Impossible d'enregistrer la modification.",stateError:"État temporairement indisponible.",attachments:"Pièces jointes",openFile:"OUVRIR",filePending:"Pièce jointe en attente de validation",waiting:"En attente de confirmation",confirmed:"Confirmé",event:"Événement",workplace:"Poste",reload:"Actualiser"},
 en:{title:"Tasks",loading:"Loading tasks and equipment…",failed:"Could not load tasks.",retry:"Try again",wait:"Tasks are available once your assigned shift starts.",noTasks:"No assigned tasks.",confirm:"Awaiting confirmation",check:"Operational checklists",noCheck:"No checklists available.",done:"DONE",open:"OPEN",complete:"COMPLETE ITEM",reopen:"REOPEN ITEM",required:"REQUIRED",photo:"PHOTO REQUIRED",proof:"View evidence photo",material:"My equipment",noMaterial:"No equipment assigned to you.",outstanding:"Outstanding",pending:"Report waiting for review",cancel:"CANCEL REPORT",note:"Note (optional)",quantity:"Quantity",returned:"REPORT RETURN",damaged:"REPORT DAMAGE",missing:"REPORT MISSING",history:"Recent equipment reports",movements:"Recent equipment movements",submitError:"Could not save change.",stateError:"Current status unavailable.",attachments:"Attachments",openFile:"OPEN",filePending:"Attachment awaiting security scan",waiting:"Awaiting confirmation",confirmed:"Confirmed",event:"Event",workplace:"Workplace",reload:"Refresh"},
 de:{title:"Aufgaben",loading:"Aufgaben und Material werden geladen…",failed:"Aufgaben konnten nicht geladen werden.",retry:"Erneut versuchen",wait:"Aufgaben sind ab Beginn deiner Schicht verfügbar.",noTasks:"Keine Aufgaben zugeteilt.",confirm:"Bestätigung ausstehend",check:"Betriebliche Checklisten",noCheck:"Keine Checklisten verfügbar.",done:"ERLEDIGT",open:"OFFEN",complete:"PUNKT ABSCHLIESSEN",reopen:"PUNKT WIEDER ÖFFNEN",required:"PFLICHT",photo:"FOTO ERFORDERLICH",proof:"Beweisfoto ansehen",material:"Mein Material",noMaterial:"Dir ist aktuell kein Material zugeteilt.",outstanding:"Ausstehend",pending:"Meldung wartet auf Prüfung",cancel:"MELDUNG STORNIEREN",note:"Notiz (optional)",quantity:"Menge bearbeiten",returned:"RÜCKGABE MELDEN",damaged:"SCHADEN MELDEN",missing:"VERLUST MELDEN",history:"Letzte Materialmeldungen",movements:"Letzte Materialbewegungen",submitError:"Änderung konnte nicht gespeichert werden.",stateError:"Status derzeit nicht verfügbar.",attachments:"Anhänge",openFile:"ÖFFNEN",filePending:"Anhang wartet auf Sicherheitsprüfung",waiting:"Bestätigung ausstehend",confirmed:"Bestätigt",event:"Event",workplace:"Arbeitsplatz",reload:"Aktualisieren"},
} as const

export function StaffTasksClient({userId}:{userId:string}){
 const db=useMemo(()=>createClient(),[])
 const router=useRouter()
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [reload,setReload]=useState(0)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [active,setActive]=useState(false)
 const [hasOpenAssigned,setHasOpenAssigned]=useState(false)
 const [assignments,setAssignments]=useState<Task[]>([])
 const [checklists,setChecklists]=useState<Checklist[]>([])
 const [checklistItems,setChecklistItems]=useState<Item[]>([])
 const [issues,setIssues]=useState<Issue[]>([])
 const [inventory,setInventory]=useState<Inventory[]>([])
 const [requests,setRequests]=useState<Request[]>([])
 const [movements,setMovements]=useState<Movement[]>([])
 const [attachments,setAttachments]=useState<Attachment[]>([])
 const [urls,setUrls]=useState<Record<string,string>>({})
 const [actionError,setActionError]=useState(false)
 useEffect(()=>{const f=()=>setLocale(activeUiLocale());f();window.addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 useEffect(()=>{
  let alive=true
  void(async()=>{
   try{
    const signal=AbortSignal.timeout(14_000)
    // First enforce the same active-shift and open membership gates as the
    // original server task view. All reads use signed browser JWT and RLS.
    const [events,memberships,shifts]=await Promise.all([
     db.from("events").select("id,end_at").neq("status","archived").gte("end_at",new Date().toISOString()).abortSignal(signal),
     db.from("event_members").select("event_id").eq("user_id",userId).abortSignal(signal),
     db.from("shifts").select("event_id,workplace_id,scheduled_start,scheduled_end").eq("user_id",userId).neq("status","cancelled").abortSignal(signal),
    ])
    if(events.error||memberships.error||shifts.error)throw Error("Work shift authorization unavailable")
    const ids=new Set((events.data??[]).map(row=>row.id))
    const open=(memberships.data??[]).some(row=>ids.has(row.event_id))
    const now=Date.now()
    const current=(shifts.data??[]).filter(row=>Date.parse(row.scheduled_start)<=now&&Date.parse(row.scheduled_end)>=now)
    if(!alive)return
    setHasOpenAssigned(open);setActive(current.length>0)
    if(!open||!current.length){
     setAssignments([]);setChecklists([]);setChecklistItems([]);setIssues([]);setRequests([]);setMovements([]);setAttachments([])
     setLoading(false);setError(false);return
    }
    const [tasks,checks,issueRows,requestRows,materials,moveRows]=await Promise.all([
     db.from("task_assignments").select("id,user_id,status,confirmed_at,tasks(id,title,description,event_id,workplace_id)").eq("user_id",userId).order("created_at").abortSignal(signal),
     db.from("operational_checklists").select("id,event_id,workplace_id,title,description,kind,status").order("created_at",{ascending:false}).abortSignal(signal),
     db.from("inventory_issues").select("id,item_id,user_id,quantity,outstanding_quantity,issued_at,notes").eq("user_id",userId).order("issued_at",{ascending:false}).limit(200).abortSignal(signal),
     db.from("inventory_settlement_requests").select("id,issue_id,status,condition,quantity,notes,decision_note,user_id").eq("user_id",userId).order("created_at",{ascending:false}).limit(100).abortSignal(signal),
     db.from("inventory_items").select("id,name").eq("is_active",true).order("name").abortSignal(signal),
     db.from("inventory_movements").select("id,item_id,movement_type,notes,created_at,quantity").order("created_at",{ascending:false}).limit(10).abortSignal(signal),
    ])
    if(tasks.error||checks.error||issueRows.error||requestRows.error||materials.error||moveRows.error)throw Error("Staff task read unavailable")
    const eventIds=new Set(current.map(row=>row.event_id))
    const ownTasks=(tasks.data??[]).filter(row=>row.tasks?.event_id&&eventIds.has(row.tasks.event_id)) as Task[]
    const checkRows=(checks.data??[]) as Checklist[]
    const idsForCheck=checkRows.map(c=>c.id)
    const idsForTask=ownTasks.map(t=>t.tasks?.id).filter((x):x is string=>Boolean(x))
    const [itemsResult,filesResult]=await Promise.all([
     idsForCheck.length?db.from("checklist_items").select("id,checklist_id,label,required,requires_photo,completed_at,completed_by,photo_path").in("checklist_id",idsForCheck).order("sort_order").abortSignal(signal):Promise.resolve({data:[],error:null}),
     idsForTask.length?db.from("work_attachments").select("id,task_id,storage_path,mime_type").in("task_id",idsForTask).order("created_at").abortSignal(signal):Promise.resolve({data:[],error:null}),
    ])
    if(itemsResult.error||filesResult.error)throw Error("Task attachments/checklist unavailable")
    const fileRows=(filesResult.data??[]) as Attachment[]
    const itemRows=(itemsResult.data??[]) as Item[]
    if(!alive)return
    setAssignments(ownTasks);setChecklists(checkRows);setChecklistItems(itemRows)
    setIssues((issueRows.data??[]) as Issue[]);setRequests((requestRows.data??[]) as Request[])
    setInventory((materials.data??[]) as Inventory[]);setMovements((moveRows.data??[]) as Movement[])
    setAttachments(fileRows)
    setLoading(false);setError(false)
    // Sign only the RLS-approved paths. Never expose a server service key.
    const paths=[...new Set([...fileRows.map(x=>x.storage_path),...itemRows.map(x=>x.photo_path||"")].filter(Boolean))]
    const signed:Record<string,string>={}
    for(let n=0;n<paths.length;n+=80){
     const response=await db.storage.from("work-media").createSignedUrls(paths.slice(n,n+80),300)
     if(response.error)continue
     for(const row of response.data??[])if(row.path&&row.signedUrl&&paths.includes(row.path))signed[row.path]=row.signedUrl
    }
    if(alive)setUrls(signed)
   }catch{if(alive){setError(true);setLoading(false)}}
  })()
  return()=>{alive=false}
 },[db,userId,reload])
 const t=translations[locale]
 const refresh=()=>{setReload(x=>x+1);router.refresh()}
 const submit=async(action:(fd:FormData)=>Promise<unknown>,fd:FormData)=>{
  setActionError(false)
  try{await action(fd);refresh()}catch{setActionError(true)}
 }
 const liveTasks=useMemo(()=>assignments,[assignments])
 const pending=new Map(requests.filter(x=>x.status==="pending").map(x=>[x.issue_id,x]))
 const inventoryById=new Map(inventory.map(x=>[x.id,x.name]))
 return <main className="space-y-5 p-4 pb-24 md:p-8">
  <header className="flex justify-between gap-3"><h1 className="text-3xl font-black">{t.title}</h1><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{setLoading(true);refresh()}}>{t.reload}</button></header>
  {loading?<p role="status">{t.loading}</p>:null}
  {error?<p role="alert">{t.failed} <button type="button" className="underline" onClick={()=>{setError(false);setLoading(true);refresh()}}>{t.retry}</button></p>:null}
  {!loading&&!error&&!hasOpenAssigned?<p className="text-muted-foreground">{t.wait} <Link prefetch={false} href="/events" className="underline">{t.event}</Link></p>:null}
  {!loading&&!error&&hasOpenAssigned&&!active?<p className="rounded-xl border p-4 text-muted-foreground">{t.wait}</p>:null}
  {!loading&&!error&&active?<div className="space-y-5">
   {liveTasks.length===0?<p>{t.noTasks}</p>:liveTasks.map(row=><article key={row.id} className="space-y-3 rounded-xl border p-4">
    <h2 className="font-bold">{row.tasks?.title}</h2>
    <p className="whitespace-pre-wrap text-sm">{row.tasks?.description}</p>
    <p className="text-xs text-muted-foreground">{row.confirmed_at?t.confirmed:t.waiting} · {row.status}</p>
    {attachments.filter(x=>x.task_id===row.tasks?.id).length>0?<div className="flex flex-wrap gap-2">
     {attachments.filter(x=>x.task_id===row.tasks?.id).map(att=>urls[att.storage_path]
      ?<a key={att.id} href={urls[att.storage_path]} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm">{t.openFile}</a>
      :<span key={att.id} className="text-xs text-muted-foreground">{t.filePending}</span>)}
    </div>:null}
    <TaskControls id={row.id} userId={userId} confirmed={Boolean(row.confirmed_at)} onSaved={refresh}/>
   </article>)}
   <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-bold">{t.check}</h2>
    {checklists.length===0?<p className="text-sm text-muted-foreground">{t.noCheck}</p>:checklists.map(check=><article key={check.id} className="space-y-3 rounded-lg border p-3">
     <div><h3 className="font-semibold">{check.title}</h3>{check.description?<p className="text-sm">{check.description}</p>:null}<p className="text-xs text-muted-foreground">{check.kind} · {check.status}</p></div>
     {checklistItems.filter(item=>item.checklist_id===check.id).map(item=><div key={item.id} className="space-y-2 rounded-lg border p-3">
      <p className={item.completed_at?"line-through opacity-70":"font-semibold"}>{item.label}</p>
      <p className="text-xs">{item.required?t.required:""} {item.requires_photo?t.photo:""} {item.completed_at?t.done:t.open}</p>
      {item.photo_path&&urls[item.photo_path]?<a className="underline text-sm" href={urls[item.photo_path]} target="_blank" rel="noreferrer">{t.proof}</a>:null}
      {check.status!=="completed"&&!item.completed_at?<form action={fd=>submit(completeOperationalChecklistItem,fd)} className="flex flex-wrap gap-2">
       <input type="hidden" name="item_id" value={item.id}/>
       {item.requires_photo?<input type="file" name="photo" required accept="image/jpeg,image/png,image/webp" className="rounded border p-2"/>:null}
       <button className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white">{t.complete}</button>
      </form>:null}
      {check.status!=="completed"&&item.completed_at&&item.completed_by===userId?<form action={fd=>submit(reopenOperationalChecklistItem,fd)}>
       <input type="hidden" name="item_id" value={item.id}/>
       <button className="rounded-lg border px-3 py-2 text-sm">{t.reopen}</button>
      </form>:null}
     </div>)}
    </article>)}
   </section>
   <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-bold">{t.material}</h2>
    {issues.filter(x=>x.outstanding_quantity>0).length===0?<p className="text-sm text-muted-foreground">{t.noMaterial}</p>:issues.filter(x=>x.outstanding_quantity>0).map(issue=><article key={issue.id} className="space-y-3 rounded-lg border p-3">
     <h3 className="font-semibold">{inventoryById.get(issue.item_id)||t.material}</h3>
     <p className="text-sm">{t.outstanding}: {issue.outstanding_quantity}/{issue.quantity}</p>
     {issue.notes?<p className="text-sm text-muted-foreground">{issue.notes}</p>:null}
     {pending.has(issue.id)?<div><p className="text-sm">{t.pending}: {pending.get(issue.id)?.condition} · {pending.get(issue.id)?.quantity}</p>
      <form action={fd=>submit(cancelInventorySettlement,fd)}>
       <input type="hidden" name="request_id" value={pending.get(issue.id)!.id}/>
       <button className="rounded-lg border px-3 py-2">{t.cancel}</button>
      </form>
     </div>:<form action={fd=>submit(requestInventorySettlement,fd)} className="space-y-2">
      <input type="hidden" name="issue_id" value={issue.id}/>
      <div className="flex gap-2">
       <input name="quantity" type="number" min="1" max={issue.outstanding_quantity} defaultValue={issue.outstanding_quantity} required aria-label={t.quantity} className="w-28 rounded border bg-background p-2"/>
       <input name="notes" maxLength={1000} placeholder={t.note} className="flex-1 rounded border bg-background p-2"/>
      </div>
      <div className="flex flex-wrap gap-2">
       <button name="condition" value="returned" className="rounded-lg border p-2">{t.returned}</button>
       <button name="condition" value="damaged" className="rounded-lg border p-2 text-amber-500">{t.damaged}</button>
       <button name="condition" value="missing" className="rounded-lg border p-2 text-red-500">{t.missing}</button>
      </div>
     </form>}
    </article>)}
    {requests.some(x=>x.status!=="pending")?<details className="rounded-lg border p-3"><summary>{t.history}</summary>
     {requests.filter(x=>x.status!=="pending").slice(0,5).map(req=><p key={req.id} className="text-sm">{inventoryById.get(issues.find(i=>i.id===req.issue_id)?.item_id||"")||t.material} · {req.condition} · {req.quantity} · {req.status}</p>)}
    </details>:null}
    {movements.length>0?<details className="rounded-lg border p-3"><summary>{t.movements}</summary>
     {movements.map(row=><p key={row.id} className="text-sm">{inventoryById.get(row.item_id)||t.material} · {row.movement_type} · {row.quantity} · {new Date(row.created_at).toLocaleString(locale)}</p>)}
    </details>:null}
   </section>
   {actionError?<p role="alert" className="text-red-500">{t.submitError}</p>:null}
  </div>:null}
 </main>
}
