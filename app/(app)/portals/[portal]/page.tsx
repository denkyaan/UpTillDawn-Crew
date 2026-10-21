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

  const promotion = portal === 'promotion'
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <Link href="/portals" className="text-sm text-violet-400">← Alle portalen</Link>
    <header>
      <h1 className="text-2xl font-bold">{promotion ? 'Promotie' : 'Admin & Administratief'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{promotion
        ? 'Promotieteam: communicatie en opdrachten op één plaats.'
        : 'Administratieve opvolging met gecontroleerde toegangsrechten.'}</p>
    </header>
    {promotion ? <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Promochats</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bekijk de chatkanalen waarvoor je toegang hebt. Een aparte promotiegroep wordt pas zichtbaar wanneer deze is ingericht en vrijgegeven.</p>
        <Link href="/chat" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">Open chats →</Link>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Mijn taken</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bekijk je bestaande opdrachten. Promotiespecifieke deadlines, bewijsuploads en historiek worden afzonderlijk toegevoegd.</p>
        <Link href="/tasks" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">Open taken →</Link>
      </section>
    </div> : <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Administratieve taken</h2>
        <p className="mt-2 text-sm text-muted-foreground">Financiële inzage en invoer worden pas geactiveerd zodra de bijbehorende databasebevoegdheden en goedkeuringsflow zijn geïmplementeerd.</p>
      </section>
      {current.isAdmin && <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Beheerdersfuncties</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bestaande financiële evenementrapportage is uitsluitend voor bevoegde beheerders toegankelijk.</p>
        <Link href="/sales" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">Open sales →</Link>
      </section>}
    </div>}
  </main>
}
