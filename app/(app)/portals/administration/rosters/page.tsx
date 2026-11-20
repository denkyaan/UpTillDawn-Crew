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
async function planNewShift(form:FormData){
 "use server"
 const {db}=await context()
 const id=String(form.get("id")??"")
 const workplace=String(form.get("workplace")??"")
 const staff=String(form.get("staff")??"")
 const role=String(form.get("role")??"").trim()
 const kind=String(form.get("kind")??"event")
 const overlap=form.get("overlap")==="on"
 const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
 if(![id,workplace,staff].every(value=>uuid.test(value))||
  !role||role.length>200||!["event","setup","breakdown"].includes(kind))throw Error("Invalid roster assignment")
 const {error}=await (db as unknown as SupabaseClient).rpc("upt_admin_roster_plan_new",{
  p_id:id,p_workplace:workplace,p_user:staff,p_role_name:role,
  p_shift_kind:kind,p_overlap_allowed:overlap
 })
 if(error)throw Error("New shift proposal could not be prepared")
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
 nl:{newHeading:"Nieuwe shift voorstellen",newIntro:"Kies een goedgekeurd evenementlid en een werkpost voor dit evenement. Na voorlegging kan een andere Admin de nieuwe shift aanmaken.",staff:"Medewerker",workplace:"Werkpost",roleName:"Functie",shiftKind:"Type shift",overlap:"Overlap toestaan (alleen na Admin-goedkeuring)",planNew:"Nieuwe shift als ontwerp koppelen",newLinked:"Nieuwe shift voorbereid",newCreated:"Nieuwe shift aangemaakt",noNewCandidates:"Er is geen goedgekeurd evenementlid of actieve werkpost beschikbaar.",kindEvent:"Evenement",kindSetup:"Opbouw",kindBreakdown:"Afbouw",zone:"Tijden in België (Europe/Brussels). Tijdens de omschakeling naar zomer- of wintertijd zijn ontbrekende of dubbelzinnige uren niet toegestaan.",heading:"Administratieve werkroosters",intro:"Stel een nieuwe shift voor of wijzig een bestaande. Een andere Admin keurt goed; pas daarna wordt de shift afzonderlijk toegepast.",title:"Titel",event:"Evenement",start:"Begin",end:"Einde",details:"Toelichting",create:"Ontwerp maken",submit:"Voorleggen aan Admin",approve:"Goedkeuren",reject:"Afwijzen",note:"Reden bij afwijzing",empty:"Nog geen voorstellen",error:"Gegevens niet beschikbaar",draft:"Ontwerp",submitted:"Ingediend",approved:"Goedgekeurd",rejected:"Afgewezen",target:"Shift koppelen",linked:"Gekoppelde shift",chooseShift:"Kies een toekomstige, niet-uitgevoerde shift",noShifts:"Geen beschikbare toekomstige shifts voor dit evenement. Maak eerst een shift aan via de Admin-planning.",mustLink:"Koppel eerst een beschikbare shift voordat je het rooster ter goedkeuring indient.",shiftsError:"De beschikbare shifts konden niet worden geladen.",apply:"Toepassen op shift",applied:"Toegepast"},
 fr:{newHeading:"Proposer un nouveau service",newIntro:"Sélectionnez un membre approuvé et un poste de cet événement. Un autre Admin peut ensuite approuver sa création.",staff:"Membre",workplace:"Poste",roleName:"Fonction",shiftKind:"Type de service",overlap:"Autoriser le chevauchement (après approbation Admin)",planNew:"Préparer le nouveau service",newLinked:"Nouveau service préparé",newCreated:"Nouveau service créé",noNewCandidates:"Aucun membre approuvé ou poste actif n’est disponible.",kindEvent:"Événement",kindSetup:"Montage",kindBreakdown:"Démontage",zone:"Heure belge (Europe/Brussels). Les heures inexistantes ou ambiguës lors du changement d’heure sont refusées.",heading:"Plannings administratifs",intro:"Proposez une nouvelle affectation ou modifiez un service. Un autre Admin doit approuver avant l’application.",title:"Titre",event:"Événement",start:"Début",end:"Fin",details:"Détails",create:"Créer",submit:"Soumettre",approve:"Approuver",reject:"Refuser",note:"Motif du refus",empty:"Aucune proposition",error:"Données indisponibles",draft:"Brouillon",submitted:"Soumis",approved:"Approuvé",rejected:"Refusé",target:"Associer un service",linked:"Service associé",chooseShift:"Choisissez un service futur non réalisé",noShifts:"Aucun service futur disponible pour cet événement. Créez d’abord un service dans le planning Admin.",mustLink:"Associez d’abord un service disponible avant de soumettre le planning.",shiftsError:"Impossible de charger les services disponibles.",apply:"Appliquer au service",applied:"Appliqué"},
 en:{newHeading:"Propose a new shift",newIntro:"Choose an approved event member and workplace. Another Admin must review before the shift is created.",staff:"Crew member",workplace:"Workplace",roleName:"Position",shiftKind:"Shift type",overlap:"Allow overlap (requires Admin approval)",planNew:"Prepare new shift proposal",newLinked:"New shift prepared",newCreated:"New shift created",noNewCandidates:"No approved event members or active workplaces are available.",kindEvent:"Event",kindSetup:"Setup",kindBreakdown:"Breakdown",zone:"Belgian time (Europe/Brussels). Missing or ambiguous hours during daylight-saving changes are rejected.",heading:"Administrative rosters",intro:"Propose a new shift or change an existing one. A different Admin must review and explicitly apply each approved proposal.",title:"Title",event:"Event",start:"Start",end:"End",details:"Details",create:"Create draft",submit:"Submit to Admin",approve:"Approve",reject:"Reject",note:"Rejection reason",empty:"No proposals yet",error:"Records unavailable",draft:"Draft",submitted:"Submitted",approved:"Approved",rejected:"Rejected",target:"Link shift",linked:"Linked shift",chooseShift:"Choose a future shift without recorded work",noShifts:"No eligible future shifts exist for this event. Create a shift through Admin scheduling first.",mustLink:"Link an eligible shift before submitting this roster for review.",shiftsError:"Could not load eligible shifts.",apply:"Apply to shift",applied:"Applied"},
 de:{newHeading:"Neue Schicht vorschlagen",newIntro:"Genehmigtes Eventmitglied und Arbeitsplatz wählen. Ein anderer Admin muss die neue Schicht genehmigen.",staff:"Mitarbeiter",workplace:"Arbeitsplatz",roleName:"Position",shiftKind:"Schichtart",overlap:"Überschneidung zulassen (nur mit Admin-Freigabe)",planNew:"Neue Schicht vorbereiten",newLinked:"Neue Schicht vorbereitet",newCreated:"Neue Schicht angelegt",noNewCandidates:"Keine genehmigten Eventmitglieder oder aktiven Arbeitsplätze verfügbar.",kindEvent:"Event",kindSetup:"Aufbau",kindBreakdown:"Abbau",zone:"Belgische Zeit (Europe/Brussels). Fehlende oder doppelte Uhrzeiten bei der Zeitumstellung werden abgelehnt.",heading:"Administrative Dienstpläne",intro:"Neue Schicht vorschlagen oder vorhandene ändern. Ein anderer Admin muss jeden Vorschlag prüfen und ausdrücklich anwenden.",title:"Titel",event:"Event",start:"Beginn",end:"Ende",details:"Details",create:"Entwurf erstellen",submit:"Einreichen",approve:"Genehmigen",reject:"Ablehnen",note:"Ablehnungsgrund",empty:"Noch keine Vorschläge",error:"Daten nicht verfügbar",draft:"Entwurf",submitted:"Eingereicht",approved:"Genehmigt",rejected:"Abgelehnt",target:"Schicht zuordnen",linked:"Zugeordnete Schicht",chooseShift:"Künftige Schicht ohne geleistete Arbeit auswählen",noShifts:"Keine zukünftigen Schichten für dieses Event verfügbar. Zuerst in der Admin-Planung eine Schicht erstellen.",mustLink:"Vor der Einreichung eine verfügbare Schicht zuordnen.",shiftsError:"Verfügbare Schichten konnten nicht geladen werden.",apply:"Auf Schicht anwenden",applied:"Angewendet"}
 } as const)[locale]
 const timeLabel=(iso:string)=>new Intl.DateTimeFormat(locale,{timeZone:"Europe/Brussels",dateStyle:"short",timeStyle:"short"}).format(new Date(iso))
 const [events,proposals,shifts,staff,workplaces]=await Promise.all([
  db.from("events").select("id,name").order("name").limit(100),
  (db as unknown as SupabaseClient).from("admin_roster_proposals")
   .select("id,title,details,status,proposed_start,proposed_end,created_by,review_note,event_id,target_shift_id,applied_at,plan_kind,planned_user_id,planned_workplace_id,planned_role_name,planned_shift_kind,planned_overlap_allowed,created_shift_id")
   .order("created_at",{ascending:false}).limit(100),
  (db as unknown as SupabaseClient).rpc("upt_admin_roster_shift_options"),
  (db as unknown as SupabaseClient).rpc("upt_admin_roster_staff_options"),
  (db as unknown as SupabaseClient).rpc("upt_admin_roster_workplace_options")
 ])
 const rosterShifts=(shifts.data??[]) as {id:string;event_id:string;scheduled_start:string;scheduled_end:string}[]
 const rosterStaff=(staff.data??[]) as {user_id:string;event_id:string;full_name:string}[]
 const rosterWorkplaces=(workplaces.data??[]) as {workplace_id:string;event_id:string;name:string}[]
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
  <section className="space-y-3">{shifts.error&&<p role="alert" className="rounded-lg border border-amber-500/50 p-3 text-sm">{l.shiftsError}</p>}{proposals.error?<p>{l.error}</p>:!proposals.data?.length?<p>{l.empty}</p>:proposals.data.map(p=>{const available=rosterShifts.filter(x=>x.event_id===p.event_id);const chosen=available.find(x=>x.id===p.target_shift_id);const staffFor=rosterStaff.filter(x=>x.event_id===p.event_id);const workplacesFor=rosterWorkplaces.filter(x=>x.event_id===p.event_id);const creating=p.plan_kind==="create";const canSubmit=creating?Boolean(p.planned_user_id&&p.planned_workplace_id&&p.planned_role_name):Boolean(chosen);const optionsFailed=creating?Boolean(staff.error||workplaces.error):Boolean(shifts.error);return <article key={p.id} className="space-y-3 rounded-xl border bg-card p-4">
   <div className="flex justify-between gap-3"><strong>{p.title}</strong><span className="text-xs text-violet-400">{l[p.status as keyof typeof l]??p.status}</span></div>
   <p className="text-sm text-muted-foreground">{timeLabel(p.proposed_start)} – {timeLabel(p.proposed_end)}</p>
   {p.details&&<p className="text-sm">{p.details}</p>}{p.review_note&&<p className="text-sm">{p.review_note}</p>}
   {p.status==="draft"&&(available.length&&!shifts.error?<form action={shiftAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id}/><select required name="shift" defaultValue={chosen?.id??""} className="min-w-48 flex-1 rounded-lg border bg-background p-2"><option value="" disabled>{l.chooseShift}</option>{available.map(x=><option key={x.id} value={x.id}>{timeLabel(x.scheduled_start)} – {timeLabel(x.scheduled_end)}</option>)}</select><button name="action" value="target" className="rounded-lg border px-3 py-2 text-sm">{l.target}</button></form>:!shifts.error&&!creating?<p className="text-sm text-amber-500">{l.noShifts}</p>:null)}
   {p.status==="draft"&&!creating&&chosen&&<p className="text-xs text-muted-foreground">{l.linked}: {timeLabel(chosen.scheduled_start)} – {timeLabel(chosen.scheduled_end)}</p>}
   {p.status==="draft"&&<section className="space-y-2 rounded-lg border p-3">
    <h3 className="font-semibold">{l.newHeading}</h3>
    <p className="text-xs text-muted-foreground">{l.newIntro}</p>
    {staff.error||workplaces.error?<p role="alert" className="text-sm text-amber-500">{l.error}</p>:
     staffFor.length&&workplacesFor.length?<form action={planNewShift} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="id" value={p.id}/>
      <label className="grid gap-1 text-sm">{l.staff}
       <select required name="staff" defaultValue={creating?p.planned_user_id??"":""} className="rounded-lg border bg-background p-2">
        <option value="" disabled>{l.staff}</option>{staffFor.map(person=><option key={person.user_id} value={person.user_id}>{person.full_name}</option>)}
       </select>
      </label>
      <label className="grid gap-1 text-sm">{l.workplace}
       <select required name="workplace" defaultValue={creating?p.planned_workplace_id??"":""} className="rounded-lg border bg-background p-2">
        <option value="" disabled>{l.workplace}</option>{workplacesFor.map(post=><option key={post.workplace_id} value={post.workplace_id}>{post.name}</option>)}
       </select>
      </label>
      <label className="grid gap-1 text-sm">{l.roleName}
       <input required name="role" maxLength={200} defaultValue={creating?p.planned_role_name??"Crew":"Crew"} className="rounded-lg border bg-background p-2"/>
      </label>
      <label className="grid gap-1 text-sm">{l.shiftKind}
       <select name="kind" defaultValue={creating?p.planned_shift_kind??"event":"event"} className="rounded-lg border bg-background p-2">
        <option value="event">{l.kindEvent}</option><option value="setup">{l.kindSetup}</option><option value="breakdown">{l.kindBreakdown}</option>
       </select>
      </label>
      <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" name="overlap" defaultChecked={creating&&p.planned_overlap_allowed===true}/>{l.overlap}</label>
      <button className="rounded-lg border border-violet-500 px-3 py-2 text-sm font-semibold text-violet-400 sm:col-span-2">{l.planNew}</button>
     </form>:<p className="text-sm text-amber-500">{l.noNewCandidates}</p>}
   </section>}
   {creating&&p.planned_user_id&&p.planned_workplace_id&&<p className="text-xs text-muted-foreground">{l.newLinked}: {staffFor.find(x=>x.user_id===p.planned_user_id)?.full_name??p.planned_user_id.slice(0,8)} · {workplacesFor.find(x=>x.workplace_id===p.planned_workplace_id)?.name??p.planned_workplace_id.slice(0,8)}</p>}
   {p.applied_at&&<p className="text-sm text-muted-foreground">{l.applied}{p.created_shift_id&&<> · {l.newCreated}: {p.created_shift_id.slice(0,8)}</>}</p>}
   {p.status==="approved"&&(creating||Boolean(p.target_shift_id))&&!p.applied_at&&(user.realIsAdmin||user.isOwner)&&<form action={shiftAction}><input type="hidden" name="id" value={p.id}/><button name="action" value="apply" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">{l.apply}</button></form>}
   {p.status==="draft"&&(canSubmit&&!optionsFailed?<form action={changeStatus}><input type="hidden" name="id" value={p.id}/><button name="action" value="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white">{l.submit}</button></form>:<p className="text-xs text-amber-500">{l.mustLink}</p>)}
   {p.status==="submitted"&&(user.realIsAdmin||user.isOwner)&&p.created_by!==user.id&&<form action={changeStatus} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id}/><input name="note" placeholder={l.note} className="min-w-48 flex-1 rounded-lg border bg-background p-2"/><button name="action" value="approve" className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">{l.approve}</button><button name="action" value="reject" className="rounded-lg border px-3 py-2 text-sm">{l.reject}</button></form>}
  </article>})}</section>
 </main>
}
