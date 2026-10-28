import Link from "next/link"
import {MessagesSquare,ClipboardCheck,ArrowUpRight,Clock3,CheckCircle2} from "lucide-react"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"
export const dynamic="force-dynamic"
export default async function PromotionHome(){
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const locale=await requestUiLocale()
 const db=await createClient()
 const {data:blocked,error:blockError}=await db.rpc("upt_promotion_is_blocked" as never)
 const isBlocked=!current.isOwner&&!current.realIsAdmin&&(blockError!==null||blocked!==false)
 const {data:assignments,error}=await db.from("task_assignments").select("id,status").eq("user_id",current.id).limit(500)
 const notStarted=(assignments??[]).filter(item=>item.status==="NOT STARTED").length
 const inProgress=(assignments??[]).filter(item=>item.status==="IN PROGRESS").length
 const open=notStarted+inProgress
 const countIsPartial=(assignments??[]).length===500
 const copy={
  nl:{heading:"Promotieoverzicht",intro:"Communiceer met de promotieploeg en volg je opdrachten op.",chat:"Chat",chatDetail:"Open de promotiegesprekken en evenementchats.",tasks:"Takenlijst",tasksDetail:"Bekijk opdrachten, deadlines en bewijsstatussen.",open:"Openstaande opdrachten",notStarted:"Nog te starten",inProgress:"Bezig",partial:"Minstens (maximaal 500 opdrachten geladen)",blocked:"Je promotietoegang is geblokkeerd. Nieuwe opdrachten en bewijsuploads zijn niet beschikbaar.",error:"Het takenoverzicht kon niet worden geladen."},
  fr:{heading:"Aperçu promotion",intro:"Communiquez avec l'équipe et suivez vos missions.",chat:"Discussions",chatDetail:"Ouvrir les discussions de promotion et d'événement.",tasks:"Liste des tâches",tasksDetail:"Consulter les missions, échéances et preuves.",open:"Missions en cours",notStarted:"À commencer",inProgress:"En cours",partial:"Au moins (500 missions chargées au maximum)",blocked:"Votre accès promotion est suspendu. Les missions et preuves ne sont pas disponibles.",error:"Impossible de charger les tâches."},
  en:{heading:"Promotion overview",intro:"Coordinate with the promotion team and track assignments.",chat:"Chats",chatDetail:"Open promotion and event conversations.",tasks:"Task list",tasksDetail:"Review assignments, deadlines and evidence status.",open:"Open assignments",notStarted:"Not started",inProgress:"In progress",partial:"At least (maximum 500 assignments loaded)",blocked:"Your promotion access is restricted. New tasks and evidence uploads are unavailable.",error:"Could not load assignments."},
  de:{heading:"Promotionübersicht",intro:"Kommuniziere mit dem Team und verfolge deine Aufgaben.",chat:"Chats",chatDetail:"Promotion- und Event-Chats öffnen.",tasks:"Aufgabenliste",tasksDetail:"Aufgaben, Fristen und Nachweise ansehen.",open:"Offene Aufgaben",notStarted:"Noch nicht begonnen",inProgress:"In Bearbeitung",partial:"Mindestens (maximal 500 Aufgaben geladen)",blocked:"Dein Promotionzugang ist gesperrt. Neue Aufgaben und Nachweise sind nicht verfügbar.",error:"Aufgaben konnten nicht geladen werden."}
 } as const
 const t=copy[locale]
 return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
  <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Up Till Dawn / Promotion</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.heading}</h1><p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p></header>
  {isBlocked&&<p role="alert" className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-4 text-sm">{t.blocked}</p>}
  {error&&<p role="alert" className="rounded-xl border border-destructive/60 p-4 text-sm">{t.error}</p>}
  <section aria-label={t.open} className="grid grid-cols-3 gap-2 sm:gap-4">
   {[{label:t.open,value:open,icon:ClipboardCheck},{label:t.notStarted,value:notStarted,icon:Clock3},{label:t.inProgress,value:inProgress,icon:CheckCircle2}].map(stat=>{const Icon=stat.icon;return <div key={stat.label} className="min-w-0 rounded-2xl border bg-card p-3 sm:p-5"><Icon aria-hidden="true" className="mb-3 h-5 w-5 text-violet-400"/><p className="text-2xl font-bold tabular-nums">{error?"—":stat.value}</p><p className="mt-1 text-xs leading-snug text-muted-foreground">{stat.label}</p></div>})}
  </section>
  {countIsPartial&&!error&&<p className="text-xs text-muted-foreground">{t.partial}</p>}
  <section className="grid gap-3 sm:grid-cols-2" aria-label={t.heading}>
   <Link href="/portals/promotion/tasks" className="group flex min-h-36 items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-violet-500/60 hover:bg-violet-500/5 focus-visible:outline-2 focus-visible:outline-violet-500"><span className="rounded-xl bg-violet-500/10 p-3 text-violet-400"><ClipboardCheck className="h-6 w-6"/></span><span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{t.tasks}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.tasksDetail}</span></span><ArrowUpRight aria-hidden className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></Link>
   <Link href="/chat" className="group flex min-h-36 items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-violet-500/60 hover:bg-violet-500/5 focus-visible:outline-2 focus-visible:outline-violet-500"><span className="rounded-xl bg-violet-500/10 p-3 text-violet-400"><MessagesSquare className="h-6 w-6"/></span><span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{t.chat}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.chatDetail}</span></span><ArrowUpRight aria-hidden className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></Link>
  </section>
 </main>
}
