import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'

export const dynamic = 'force-dynamic'

export default async function PortalPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params
  if (portal !== 'promotion' && portal !== 'administration') notFound()
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upt_my_portal_assignments')
  if (error && !current.isAdmin) return <main className="p-6"><h1 className="text-xl font-bold">Portaal niet beschikbaar</h1><p className="mt-3">De toegangscontrole kan momenteel niet worden uitgevoerd. Probeer later opnieuw.</p><Link href="/portals" className="mt-4 inline-block text-violet-400">Terug naar portalen</Link></main>
  if (!current.isAdmin && !canOpenPortal(portal, (data ?? []) as PortalAssignment[], {
    approved: current.approved,
    blocked: current.account_blocked === true,
  })) notFound()

  const title = portal === 'promotion' ? 'Promotie' : 'Administratie'
  return <main className="mx-auto max-w-3xl space-y-4 p-6">
    <Link href="/portals" className="text-sm text-violet-400">← Alle portalen</Link>
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="rounded-xl border bg-card p-5 text-sm">Je toegang tot dit portaal is bevestigd. De specifieke V2.1-werkprocessen worden nog ontwikkeld; er zijn hier nog geen bewerkbare functies beschikbaar.</p>
  </main>
}
