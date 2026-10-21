import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { RoleManagementForm } from './role-management-form'

export const dynamic = 'force-dynamic'

const translations = {
  title: 'Portaalrollen',
  description: 'Overzicht van portaalroltoewijzingen.',
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
  manage: 'Portaalrol beheren',
  userId: 'Gebruikers-ID',
  action: 'Actie',
  assign: 'Toewijzen',
  approve: 'Goedkeuren',
  revoke: 'Intrekken',
  submit: 'Rolwijziging uitvoeren',
} as const

export default async function PortalRolesPage() {
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  

  // No service-role key: RLS remains authoritative, and no write operations are exposed.
  const supabase = await createClient()
  let query = supabase.from('portal_role_assignments')
    .select('id,user_id,portal,role,approved,revoked_at')
  if (!current.realIsAdmin) query = query.eq('user_id', current.id)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100)

  const { data: users } = current.realIsAdmin ? await supabase.from('profiles').select('id,full_name').eq('approved', true).eq('account_blocked', false).neq('id', current.id).order('full_name').limit(500) : { data: null }

  const t = translations
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <Link href="/portals" className="text-sm text-violet-400">{t.back}</Link>
    <h1 className="text-2xl font-bold">{t.title}</h1>
    <p className="text-sm text-muted-foreground">{t.description}</p>
    {current.realIsAdmin && <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">{t.manage}</h2><RoleManagementForm users={users ?? []} /></section>}
    {error ? <p role="alert" className="rounded-xl border border-amber-500/50 p-4">{t.error}</p>
      : !data?.length ? <p className="rounded-xl border p-4">{t.empty}</p>
      : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
        <thead><tr className="border-b bg-card"><th className="p-3">{t.person}</th><th className="p-3">{t.portal}</th><th className="p-3">{t.role}</th><th className="p-3">{t.status}</th></tr></thead>
        <tbody>{data.map(row => <tr key={row.id} className="border-b last:border-b-0"><td className="p-3 font-mono text-xs">{row.user_id}</td><td className="p-3">{row.portal}</td><td className="p-3">{row.role}</td><td className="p-3">{row.revoked_at ? t.revoked : row.approved ? t.approved : t.pending}</td></tr>)}</tbody>
      </table></div>}
  </main>
}
