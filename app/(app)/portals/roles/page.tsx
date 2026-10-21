import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'

export const dynamic = 'force-dynamic'

const translations = {
  title: 'Portaalrollen',
  description: 'Overzicht van je eigen roltoewijzingen. Wijzigingen zijn nog niet beschikbaar.',
  empty: 'Er zijn nog geen roltoewijzingen.',
  error: 'Roltoewijzingen kunnen niet worden geladen.',
  back: 'Terug naar portalen',
  person: 'Gebruiker',
  portal: 'Portaal',
  role: 'Rol',
  status: 'Status',
  approved: 'Goedgekeurd',
  pending: 'In afwachting',
  revoked: 'Ingetrokken',
} as const

export default async function PortalRolesPage() {
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  

  // No service-role key: RLS remains authoritative, and no write operations are exposed.
  const supabase = await createClient()
  const { data, error } = await supabase.from('portal_role_assignments')
    .select('id,user_id,portal,role,approved,revoked_at')
    .eq('user_id', current.id).order('created_at', { ascending: false }).limit(100)

  const t = translations
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <Link href="/portals" className="text-sm text-violet-400">{t.back}</Link>
    <h1 className="text-2xl font-bold">{t.title}</h1>
    <p className="text-sm text-muted-foreground">{t.description}</p>
    {error ? <p role="alert" className="rounded-xl border border-amber-500/50 p-4">{t.error}</p>
      : !data?.length ? <p className="rounded-xl border p-4">{t.empty}</p>
      : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
        <thead><tr className="border-b bg-card"><th className="p-3">{t.person}</th><th className="p-3">{t.portal}</th><th className="p-3">{t.role}</th><th className="p-3">{t.status}</th></tr></thead>
        <tbody>{data.map(row => <tr key={row.id} className="border-b last:border-b-0"><td className="p-3 font-mono text-xs">{row.user_id}</td><td className="p-3">{row.portal}</td><td className="p-3">{row.role}</td><td className="p-3">{row.revoked_at ? t.revoked : row.approved ? t.approved : t.pending}</td></tr>)}</tbody>
      </table></div>}
  </main>
}
