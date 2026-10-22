import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"
const route="/portals/administration/rosters"
async function context(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if(!user.approved||user.account_blocked)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 return {db,user}
}
async function createProposal(form:FormData){
 "use server"
 const {db}=await context()
 const event=String(form.get("event")??"")
 const title=String(form.get("title")??"").trim()
 const start=String(form.get("start")??"")
 const end=String(form.get("end")??"")
 if(!/^[0-9a-f-]{36}$/i.test(event)||!title||!start||!end)return
 const {error}=await db.rpc("upt_admin_roster_create",{p_event:event,p_title:title,p_details:String(form.get("details")??""),p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString()})
 if(error)throw new Error("Roster proposal could not be created")
 revalidatePath(route)
}
async function changeStatus(form:FormData){
 "use server"
 const {db,user}=await context()
 const id=String(form.get("id")??"")
 const action=String(form.get("action")??"")
 if(!/^[0-9a-f-]{36}$/i.test(id))return
 const result=action==="submit"?await db.rpc("upt_admin_roster_submit",{p_id:id}):user.isAdmin&&["approve","reject"].includes(action)?await db.rpc("upt_admin_roster_review",{p_id:id,p_approve:action==="approve",p_note:String(form.get("note")??"")}):null
 if(result?.error)throw new Error("Roster transition failed")
 revalidatePath(route)
}
export const dynamic="force-dynamic"
export default async function RostersPage(){
 const {db,user}=await context()
 const locale=await requestUiLocale()
 const l=({
 nl:{heading:"Administratieve werkroosters",intro:"Maak een roosterontwerp, dien het in en laat een andere Admin beslissen. Goedgekeurde voorstellen wijzigen bestaande shifts nog niet.",title:"Titel",event:"Evenement",start:"Begin",end:"Einde",details:"Toelichting",create:"Ontwerp maken",submit:"Voorleggen aan Admin",approve:"Goedkeuren",reject:"Afwijzen",note:"Reden bij afwijzing",empty:"Nog geen voorstellen",error:"Gegevens niet beschikbaar",draft:"Ontwerp",submitted:"Ingediend",approved:"Goedgekeurd",rejected:"Afgewezen"},
 fr:{heading:"Plannings administratifs",intro:"Créez un projet, soumettez-le à un autre administrateur. L'approbation ne modifie pas encore les shifts.",title:"Titre",event:"Événement",start:"Début",end:"Fin",details:"Détails",create:"Créer",submit:"Soumettre",approve:"Approuver",reject:"Refuser",note:"Motif du refus",empty:"Aucune proposition",error:"Données indisponibles",draft:"Brouillon",submitted:"Soumis",approved:"Approuvé",rejected:"Refusé"},
 en:{heading:"Administrative rosters",intro:"Create a draft and submit it for another Admin to review. Approval does not yet modify operational shifts.",title:"Title",event:"Event",start:"Start",end:"End",details:"Details",create:"Create draft",submit:"Submit to Admin",approve:"Approve",reject:"Reject",note:"Rejection reason",empty:"No proposals yet",error:"Records unavailable",draft:"Draft",submitted:"Submitted",approved:"Approved",rejected:"Rejected"},
 de:{heading:"Administrative Dienstpläne",intro:"Entwurf erstellen und einem anderen Admin zur Prüfung vorlegen. Freigaben ändern noch keine Schichten.",title:"Titel",event:"Event",start:"Beginn",end:"Ende",details:"Details",create:"Entwurf erstellen",submit:"Einreichen",approve:"Genehmigen",reject:"Ablehnen",note:"Ablehnungsgrund",empty:"Noch keine Vorschläge",error:"Daten nicht verfügbar",draft:"Entwurf",submitted:"Eingereicht",approved:"Genehmigt",rejected:"Abgelehnt"}
 } as const)[locale]
 const [events,proposals]=await Promise.all([db.from("events").select("id,name").order("name").limit(100),db.from("admin_roster_proposals").select("id,title,details,status,proposed_start,proposed_end,created_by,review_note,event_id").order("created_at",{ascending:false}).limit(100)])
 return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
  <header><h1 className="text-2xl font-bold">{l.heading}</h1><p className="mt-2 text-sm text-muted-foreground">{l.intro}</p></header>
  <form action={createProposal} className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
   <label className="text-sm">{l.title}<input required maxLength={180} name="title" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">{l.event}<select required name="event" className="mt-1 w-full rounded-lg border bg-background p-3">{(events.data??[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label className="text-sm">{l.start}<input required type="datetime-local" name="start" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">{l.end}<input required type="datetime-local" name="end" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm sm:col-span-2">{l.details}<textarea name="details" maxLength={2000} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button disabled={!events.data?.length} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white sm:col-span-2">{l.create}</button>
  </form>
  <section className="space-y-3">{proposals.error?<p>{l.error}</p>:!proposals.data?.length?<p>{l.empty}</p>:proposals.data.map(p=><article key={p.id} className="space-y-3 rounded-xl border bg-card p-4">
   <div className="flex justify-between gap-3"><strong>{p.title}</strong><span className="text-xs text-violet-400">{l[p.status as keyof typeof l]??p.status}</span></div>
   <p className="text-sm text-muted-foreground">{new Date(p.proposed_start).toLocaleString(locale)} – {new Date(p.proposed_end).toLocaleString(locale)}</p>
   {p.details&&<p className="text-sm">{p.details}</p>}{p.review_note&&<p className="text-sm">{p.review_note}</p>}
   {p.status==="draft"&&<form action={changeStatus}><input type="hidden" name="id" value={p.id}/><button name="action" value="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white">{l.submit}</button></form>}
   {p.status==="submitted"&&user.isAdmin&&p.created_by!==user.id&&<form action={changeStatus} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id}/><input name="note" placeholder={l.note} className="min-w-48 flex-1 rounded-lg border bg-background p-2"/><button name="action" value="approve" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">{l.approve}</button><button name="action" value="reject" className="rounded-lg border px-3 py-2 text-sm">{l.reject}</button></form>}
  </article>)}</section>
 </main>
}
