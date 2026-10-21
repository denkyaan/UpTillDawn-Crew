import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { accessiblePortals, type PortalAssignment, type Portal } from '@/lib/portal-access'

export const dynamic = 'force-dynamic'

const portalDetails: Record<Portal, { title: string; description: string; href: string }> = {
  events: {
    title: 'Evenementen',
    description: 'Evenementen, shifts, werkplaatsen, briefings en operationele taken.',
    href: '/',
  },
  promotion: {
    title: 'Promotie',
    description: 'Promotiecampagnes en de bijbehorende werkprocessen.',
    href: '/portals/promotion',
  },
  administration: {
    title: 'Administratie',
    description: 'Administratieve taken en financiële opvolging.',
    href: '/portals/administration',
  },
}

export default async function PortalSelector() {
  const current = await getCurrentUser()
  if (!current) redirect('/login')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upt_my_portal_assignments')
  const assignments = (data ?? []) as PortalAssignment[]
  const assigned = error ? [] : accessiblePortals(assignments, {
    approved: current.approved,
    blocked: current.account_blocked === true,
  })

  // Legacy event users must retain access during the additive V2.1 rollout.
  const portals: Portal[] = [...new Set<Portal>([
    ...(current.role === 'staff' || current.role === 'responsible_lead' || current.isAdmin ? ['events' as const] : []),
    ...assigned,
  ])]

  return <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
    <header>
      <h1 className="text-2xl font-bold">Mijn portalen</h1>
      <p className="mt-2 text-sm text-muted-foreground">Kies een portaal waarvoor je toegang hebt. Nieuwe rollen worden pas actief na goedkeuring.</p>
    </header>
    {error && <p role="alert" className="rounded-xl border border-amber-500/50 p-4 text-sm">Portaalrechten kunnen momenteel niet worden opgehaald. Je bestaande evenemententoegang blijft beschikbaar.</p>}
    {portals.length === 0 && <p className="rounded-xl border p-4">Er is nog geen portaal voor je account goedgekeurd. Neem contact op met een beheerder.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {portals.map(portal => {
        const detail = portalDetails[portal]
        return <Link key={portal} href={detail.href} className="rounded-2xl border bg-card p-6 transition-colors hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{detail.description}</p>
          <span className="mt-4 inline-block text-sm font-medium text-violet-400">Open portaal →</span>
        </Link>
      })}
    </div>
  </main>
}
