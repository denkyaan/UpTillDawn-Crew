import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { userVisiblePortals, type PortalAssignment, type Portal } from '@/lib/portal-access'
import { requestUiLocale } from '@/lib/server-locale'

export const dynamic = 'force-dynamic'

const portalDetails: Record<Portal, {
 title: Record<'nl'|'fr'|'en'|'de',string>
 description: Record<'nl'|'fr'|'en'|'de',string>
}> = {
 events: {
  title:{nl:'Evenementen',fr:'Événements',en:'Events',de:'Veranstaltungen'},
  description:{nl:'Evenementen, shifts, werkposten, briefings en operationele taken.',fr:'Événements, shifts, postes, briefings et tâches opérationnelles.',en:'Events, shifts, workplaces, briefings and operational tasks.',de:'Veranstaltungen, Schichten, Arbeitsplätze, Briefings und operative Aufgaben.'},
 },
 promotion: {
  title:{nl:'Promotie',fr:'Promotion',en:'Promotion',de:'Promotion'},
  description:{nl:'Promotiechats, opdrachten, bewijsindieningen en meldingen.',fr:'Discussions, missions, justificatifs et notifications de promotion.',en:'Promotion chats, assignments, evidence submissions and notifications.',de:'Promotion-Chats, Aufgaben, Nachweise und Benachrichtigungen.'},
 },
 administration: {
  title:{nl:'Administratie',fr:'Administration',en:'Administration',de:'Verwaltung'},
  description:{nl:'Facturen, planning, personeel, boekingen, voorraad en opvolging.',fr:'Factures, plannings, personnel, réservations, inventaire et suivi.',en:'Invoices, schedules, people, bookings, inventory and follow-up.',de:'Rechnungen, Planung, Personal, Buchungen, Inventar und Nachverfolgung.'},
 },
}

const copy={
 nl:{heading:'Mijn portalen',intro:'Kies het portaal waarin je wilt werken. Bij meerdere rollen blijven alle goedgekeurde portalen hier beschikbaar.',roles:'Mijn portaalrollen',unavailable:'Portaalrechten konden niet worden opgehaald. Alleen je bestaande basisrechten worden getoond.',empty:'Er is nog geen portaal goedgekeurd voor je account. Vraag een beheerder om toegang.',last:'Laatst gebruikt',open:'Open portaal'},
 fr:{heading:'Mes portails',intro:'Choisissez votre espace de travail. Si vous avez plusieurs rôles, tous vos portails approuvés restent disponibles.',roles:'Mes rôles de portail',unavailable:'Impossible de charger les autorisations. Seuls vos accès de base sont affichés.',empty:'Aucun portail approuvé pour votre compte. Contactez un administrateur.',last:'Utilisé récemment',open:'Ouvrir le portail'},
 en:{heading:'My portals',intro:'Choose where to work. When you have multiple roles, all approved portals remain available here.',roles:'My portal roles',unavailable:'Portal permissions could not be loaded. Only your existing base access is shown.',empty:'No portal has been approved for your account. Contact an administrator.',last:'Last used',open:'Open portal'},
 de:{heading:'Meine Portale',intro:'Wähle deinen Arbeitsbereich. Bei mehreren Rollen bleiben hier alle genehmigten Portale verfügbar.',roles:'Meine Portalrollen',unavailable:'Portalberechtigungen konnten nicht geladen werden. Nur bestehende Basisrechte werden angezeigt.',empty:'Für dein Konto ist noch kein Portal freigegeben. Wende dich an einen Administrator.',last:'Zuletzt verwendet',open:'Portal öffnen'},
} as const

export default async function PortalSelector() {
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 const locale = await requestUiLocale()
 const t = copy[locale]
 const db = await createClient()
 const {data,error} = await db.rpc('upt_my_portal_assignments')
 const portals = userVisiblePortals(error?[]:(data??[]) as PortalAssignment[],{
  approved:current.approved,blocked:current.account_blocked===true,
  isOwner:current.isOwner,realIsAdmin:current.realIsAdmin,role:current.role,
 })
 // Never skip the chooser when a user has multiple portal roles.
 if(portals.length===1)redirect('/portals/switch/'+portals[0])
 const last=(await cookies()).get('uptilldawn-last-portal')?.value

 return <main className="mx-auto max-w-4xl space-y-6 p-4 pb-28 md:p-8">
  <header>
   <h1 className="text-2xl font-bold">{t.heading}</h1>
   <p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
   <Link href="/portals/roles" className="mt-3 inline-flex rounded-lg border px-3 py-2 text-sm font-medium text-violet-400 hover:border-violet-500">{t.roles} →</Link>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-amber-500/50 p-4 text-sm">{t.unavailable}</p>}
  {portals.length===0&&<p role="status" className="rounded-xl border p-4">{t.empty}</p>}
  <nav className="grid gap-4 sm:grid-cols-2" aria-label={t.heading}>
   {portals.map(portal=>{
    const detail=portalDetails[portal]
    return <Link key={portal} href={'/portals/switch/'+portal}
     className="block rounded-2xl border bg-card p-6 transition-colors hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{detail.title[locale]}</h2>
      {portal===last&&<span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{t.last}</span>}
     </div>
     <p className="mt-2 text-sm text-muted-foreground">{detail.description[locale]}</p>
     <span className="mt-4 inline-block text-sm font-medium text-violet-400">{t.open} →</span>
    </Link>
   })}
  </nav>
 </main>
}
