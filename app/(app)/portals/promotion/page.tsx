import Link from "next/link"
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
 return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6"><header><h1 className="text-3xl font-black">{t.heading}</h1><p className="mt-2 text-muted-foreground">{t.intro}</p></header>
 {isBlocked&&<p role="alert" className="rounded-xl border border-amber-500 p-4">{t.blocked}</p>}
 {error&&<p role="alert" className="rounded-xl border p-3">{t.error}</p>}
 {!error&&<p className="rounded-xl border p-4 text-sm">{t.open}: <strong>{countIsPartial?t.partial+" ": ""}{open}</strong> · {t.notStarted}: <strong>{notStarted}</strong> · {t.inProgress}: <strong>{inProgress}</strong></p>}
 <div className="grid gap-4 sm:grid-cols-2">
  <Link href="/chat" className="rounded-2xl border bg-card p-6 hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"><span aria-hidden className="text-3xl">◉</span><h2 className="mt-3 text-xl font-bold">{t.chat}</h2><p className="mt-2 text-sm text-muted-foreground">{t.chatDetail}</p></Link>
  <Link href="/portals/promotion/tasks" className="rounded-2xl border bg-card p-6 hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"><span aria-hidden className="text-3xl">☑</span><h2 className="mt-3 text-xl font-bold">{t.tasks}</h2><p className="mt-2 text-sm text-muted-foreground">{t.tasksDetail}</p></Link>
 </div></main>
}
