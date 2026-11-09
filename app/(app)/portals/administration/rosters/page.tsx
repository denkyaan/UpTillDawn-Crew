import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"
import { parseBrusselsRosterTime } from "@/lib/administration/roster-local-time"
const route="/portals/administration/rosters"
async function context(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.realIsAdmin&&!user.isOwner){
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
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(event)||!title||title.length>180||!start||!end)throw new Error("Invalid roster proposal")
 const details=String(form.get("details")??"")
 if(details.length>2000)throw new Error("Roster details too long")
 const startAt=parseBrusselsRosterTime(start),endAt=parseBrusselsRosterTime(end)
 if(endAt<=startAt)throw new Error("Invalid roster time range")
 const {error}=await (db as unknown as SupabaseClient).rpc("upt_admin_roster_create",{p_event:event,p_title:title,p_details:details,p_start:startAt.toISOString(),p_end:endAt.toISOString()})
 if(error)throw new Error("Roster proposal could not be created")
 revalidatePath(route)
}
async function shiftAction(form:FormData){
 "use server"
 const {db,user}=await context()
 const id=String(form.get("id")??"")
 const shift=String(form.get("shift")??"")
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new Error("Invalid roster identifier")
 const action=String(form.get("action")??"")
 if(!["target","apply"].includes(action))throw new Error("Unknown roster action")
 const rpc=action==="target"?"upt_admin_roster_target":"upt_admin_roster_apply"
 if(rpc==="upt_admin_roster_apply"&&!user.realIsAdmin&&!user.isOwner)throw new Error("Admin required")
 if(rpc==="upt_admin_roster_target"&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(shift))throw new Error("Invalid shift identifier")
 const args=rpc==="upt_admin_roster_target"?{p_id:id,p_shift:shift}:{p_id:id}
 const {error}=await (db as unknown as SupabaseClient).rpc(rpc,args)
 if(error)throw new Error("Roster shift action failed")
 revalidatePath(route)
}
async function changeStatus(form:FormData){
 "use server"
 const {db,user}=await context()
 const id=String(form.get("id")??"")
 const action=String(form.get("action")??"")
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new Error("Invalid roster identifier")
 if(!["submit","approve","reject"].includes(action))throw new Error("Unknown roster status action")
 const note=String(form.get("note")??"").trim()
 if(note.length>2000||(action==="reject"&&!note))throw new Error("Rejection requires a reason")
 if(action!=="submit"&&!user.realIsAdmin&&!user.isOwner)throw new Error("Admin required for roster review")
 if(action!=="submit"){
  const {data:proposal,error:lookupError}=await (db as unknown as SupabaseClient).from("admin_roster_proposals").select("created_by,status").eq("id",id).maybeSingle()
  if(lookupError||!proposal||proposal.status!=="submitted")throw new Error("Roster is not awaiting review")
  if(proposal.created_by===user.id)throw new Error("Roster creator cannot review their own proposal")
 }
 const result=action==="submit"?await (db as unknown as SupabaseClient).rpc("upt_admin_roster_submit",{p_id:id}):await (db as unknown as SupabaseClient).rpc("upt_admin_roster_review",{p_id:id,p_approve:action==="approve",p_note:note})
 if(result.error)throw new Error("Roster transition failed")
 revalidatePath(route)
}
export const dynamic="force-dynamic"
export default async function RostersPage(){
 const {db,user}=await context()
 const locale=await requestUiLocale()
 const l=({
 nl:{zone:"Tijden in België (Europe/Brussels). Tijdens de omschakeling naar zomer- of wintertijd zijn ontbrekende of dubbelzinnige uren niet toegestaan.",heading:"Administratieve werkroosters",intro:"Maak een roosterontwerp, dien het in en laat een andere Admin beslissen. Goedgekeurde voorstellen worden pas na een afzonderlijke Admin-actie op de gekozen shift toegepast.",title:"Titel",event:"Evenement",start:"Begin",end:"Einde",details:"Toelichting",create:"Ontwerp maken",submit:"Voorleggen aan Admin",approve:"Goedkeuren",reject:"Afwijzen",note:"Reden bij afwijzing",empty:"Nog geen voorstellen",error:"Gegevens niet beschikbaar",draft:"Ontwerp",submitted:"Ingediend",approved:"Goedgekeurd",rejected:"Afgewezen",target:"Shift koppelen",linked:"Gekoppelde shift",chooseShift:"Kies een toekomstige, niet-uitgevoerde shift",noShifts:"Geen beschikbare toekomstige shifts voor dit evenement. Maak eerst een shift aan via de Admin-planning.",mustLink:"Koppel eerst een beschikbare shift voordat je het rooster ter goedkeuring indient.",shiftsError:"De beschikbare shifts konden niet worden geladen.",apply:"Toepassen op shift",applied:"Toegepast"},
 fr:{zone:"Heure belge (Europe/Brussels). Les heures inexistantes ou ambiguës lors du changement d’heure sont refusées.",heading:"Plannings administratifs",intro:"Créez un projet, soumettez-le à un autre administrateur. Les propositions approuvées sont appliquées uniquement après une action distincte de l’Admin.",title:"Titre",event:"Événement",start:"Début",end:"Fin",details:"Détails",create:"Créer",submit:"Soumettre",approve:"Approuver",reject:"Refuser",note:"Motif du refus",empty:"Aucune proposition",error:"Données indisponibles",draft:"Brouillon",submitted:"Soumis",approved:"Approuvé",rejected:"Refusé",target:"Associer un service",linked:"Service associé",chooseShift:"Choisissez un service futur non réalisé",noShifts:"Aucun service futur disponible pour cet événement. Créez d’abord un service dans le planning Admin.",mustLink:"Associez d’abord un service disponible avant de soumettre le planning.",shiftsError:"Impossible de charger les services disponibles.",apply:"Appliquer au service",applied:"Appliqué"},
 en:{zone:"Belgian time (Europe/Brussels). Missing or ambiguous hours during daylight-saving changes are rejected.",heading:"Administrative rosters",intro:"Create a draft and submit it for another Admin to review. Approved proposals change the selected shift only after a separate Admin action.",title:"Title",event:"Event",start:"Start",end:"End",details:"Details",create:"Create draft",submit:"Submit to Admin",approve:"Approve",reject:"Reject",note:"Rejection reason",empty:"No proposals yet",error:"Records unavailable",draft:"Draft",submitted:"Submitted",approved:"Approved",rejected:"Rejected",target:"Link shift",linked:"Linked shift",chooseShift:"Choose a future shift without recorded work",noShifts:"No eligible future shifts exist for this event. Create a shift through Admin scheduling first.",mustLink:"Link an eligible shift before submitting this roster for review.",shiftsError:"Could not load eligible shifts.",apply:"Apply to shift",applied:"Applied"},
 de:{zone:"Belgische Zeit (Europe/Brussels). Fehlende oder doppelte Uhrzeiten bei der Zeitumstellung werden abgelehnt.",heading:"Administrative Dienstpläne",intro:"Entwurf erstellen und einem anderen Admin zur Prüfung vorlegen. Genehmigte Vorschläge ändern die ausgewählte Schicht erst nach einer separaten Admin-Aktion.",title:"Titel",event:"Event",start:"Beginn",end:"Ende",details:"Details",create:"Entwurf erstellen",submit:"Einreichen",approve:"Genehmigen",reject:"Ablehnen",note:"Ablehnungsgrund",empty:"Noch keine Vorschläge",error:"Daten nicht verfügbar",draft:"Entwurf",submitted:"Eingereicht",approved:"Genehmigt",rejected:"Abgelehnt",target:"Schicht zuordnen",linked:"Zugeordnete Schicht",chooseShift:"Künftige Schicht ohne geleistete Arbeit auswählen",noShifts:"Keine zukünftigen Schichten für dieses Event verfügbar. Zuerst in der Admin-Planung eine Schicht erstellen.",mustLink:"Vor der Einreichung eine verfügbare Schicht zuordnen.",shiftsError:"Verfügbare Schichten konnten nicht geladen werden.",apply:"Auf Schicht anwenden",applied:"Angewendet"}
 } as const)[locale]
 const timeLabel=(iso:string)=>new Intl.DateTimeFormat(locale,{timeZone:"Europe/Brussels",dateStyle:"short",timeStyle:"short"}).format(new Date(iso))
 const [events,proposals,shifts]=await Promise.all([db.from("events").select("id,name").order("name").limit(100),(db as unknown as SupabaseClient).from("admin_roster_proposals").select("id,title,details,status,proposed_start,proposed_end,created_by,review_note,event_id,target_shift_id,applied_at").order("created_at",{ascending:false}).limit(100),(db as unknown as SupabaseClient).rpc("upt_admin_roster_shift_options")])
 const rosterShifts=(shifts.data??[]) as {id:string;event_id:string;scheduled_start:string;scheduled_end:string}[]
 return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
  <header><h1 className="text-2xl font-bold">{l.heading}</h1><p className="mt-2 text-sm text-muted-foreground">{l.intro}</p></header>
  <form action={createProposal} className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
   <p className="text-xs text-muted-foreground sm:col-span-2">{l.zone}</p>
   <label className="text-sm">{l.title}<input required maxLength={180} name="title" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">{l.event}<select required name="event" className="mt-1 w-full rounded-lg border bg-background p-3">{(events.data??[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label className="text-sm">{l.start}<input required type="datetime-local" name="start" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm">{l.end}<input required type="datetime-local" name="end" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm sm:col-span-2">{l.details}<textarea name="details" maxLength={2000} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button disabled={!events.data?.length} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white sm:col-span-2">{l.create}</button>
  </form>
  <section className="space-y-3">{shifts.error&&<p role="alert" className="rounded-lg border border-amber-500/50 p-3 text-sm">{l.shiftsError}</p>}{proposals.error?<p>{l.error}</p>:!proposals.data?.length?<p>{l.empty}</p>:proposals.data.map(p=>{const available=rosterShifts.filter(x=>x.event_id===p.event_id);const chosen=available.find(x=>x.id===p.target_shift_id);const canSubmit=Boolean(chosen);return <article key={p.id} className="space-y-3 rounded-xl border bg-card p-4">
   <div className="flex justify-between gap-3"><strong>{p.title}</strong><span className="text-xs text-violet-400">{l[p.status as keyof typeof l]??p.status}</span></div>
   <p className="text-sm text-muted-foreground">{timeLabel(p.proposed_start)} – {timeLabel(p.proposed_end)}</p>
   {p.details&&<p className="text-sm">{p.details}</p>}{p.review_note&&<p className="text-sm">{p.review_note}</p>}
   {p.status==="draft"&&(available.length&&!shifts.error?<form action={shiftAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id}/><select required name="shift" defaultValue={chosen?.id??""} className="min-w-48 flex-1 rounded-lg border bg-background p-2"><option value="" disabled>{l.chooseShift}</option>{available.map(x=><option key={x.id} value={x.id}>{timeLabel(x.scheduled_start)} – {timeLabel(x.scheduled_end)}</option>)}</select><button name="action" value="target" className="rounded-lg border px-3 py-2 text-sm">{l.target}</button></form>:!shifts.error?<p className="text-sm text-amber-500">{l.noShifts}</p>:null)}
   {p.status==="draft"&&chosen&&<p className="text-xs text-muted-foreground">{l.linked}: {timeLabel(chosen.scheduled_start)} – {timeLabel(chosen.scheduled_end)}</p>}
   {p.applied_at&&<p className="text-sm text-muted-foreground">{l.applied}</p>}
   {p.status==="approved"&&p.target_shift_id&&!p.applied_at&&(user.realIsAdmin||user.isOwner)&&<form action={shiftAction}><input type="hidden" name="id" value={p.id}/><button name="action" value="apply" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">{l.apply}</button></form>}
   {p.status==="draft"&&(canSubmit&&!shifts.error?<form action={changeStatus}><input type="hidden" name="id" value={p.id}/><button name="action" value="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white">{l.submit}</button></form>:<p className="text-xs text-amber-500">{l.mustLink}</p>)}
   {p.status==="submitted"&&(user.realIsAdmin||user.isOwner)&&p.created_by!==user.id&&<form action={changeStatus} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id}/><input name="note" placeholder={l.note} className="min-w-48 flex-1 rounded-lg border bg-background p-2"/><button name="action" value="approve" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">{l.approve}</button><button name="action" value="reject" className="rounded-lg border px-3 py-2 text-sm">{l.reject}</button></form>}
  </article>})}</section>
 </main>
}
