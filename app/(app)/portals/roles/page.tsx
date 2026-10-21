import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { changePortalRole } from '@/lib/actions/portal-roles'

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

  const t = translations
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <Link href="/portals" className="text-sm text-violet-400">{t.back}</Link>
    <h1 className="text-2xl font-bold">{t.title}</h1>
    <p className="text-sm text-muted-foreground">{t.description}</p>
    {current.realIsAdmin && <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">{t.manage}</h2><form action={changePortalRole} className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">{t.userId}<input required name="user_id" type="text" pattern="[0-9a-fA-F-]{36}" className="rounded border bg-background p-2" /></label><label className="grid gap-1 text-sm">{t.portal}<select name="portal" className="rounded border bg-background p-2"><option value="events">events</option><option value="promotion">promotion</option><option value="administration">administration</option></select></label><label className="grid gap-1 text-sm">{t.role}<select name="role" className="rounded border bg-background p-2"><option value="event_staff">event_staff</option><option value="event_responsible">event_responsible</option><option value="promoter">promoter</option><option value="administrative_staff">administrative_staff</option></select></label><label className="grid gap-1 text-sm">{t.action}<select name="action" className="rounded border bg-background p-2"><option value="assign">{t.assign}</option><option value="approve">{t.approve}</option><option value="revoke">{t.revoke}</option></select></label><button type="submit" className="rounded bg-violet-600 px-4 py-2 font-medium text-white">{t.submit}</button></form></section>}
    {error ? <p role="alert" className="rounded-xl border border-amber-500/50 p-4">{t.error}</p>
      : !data?.length ? <p className="rounded-xl border p-4">{t.empty}</p>
      : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
        <thead><tr className="border-b bg-card"><th className="p-3">{t.person}</th><th className="p-3">{t.portal}</th><th className="p-3">{t.role}</th><th className="p-3">{t.status}</th></tr></thead>
        <tbody>{data.map(row => <tr key={row.id} className="border-b last:border-b-0"><td className="p-3 font-mono text-xs">{row.user_id}</td><td className="p-3">{row.portal}</td><td className="p-3">{row.role}</td><td className="p-3">{row.revoked_at ? t.revoked : row.approved ? t.approved : t.pending}</td></tr>)}</tbody>
      </table></div>}
  </main>
}
