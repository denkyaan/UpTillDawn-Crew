import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'

export const dynamic = 'force-dynamic'

const translations = {
  nl: { title: 'Portaalrollen', description: 'Overzicht van bestaande roltoewijzingen. Wijzigingen zijn nog niet beschikbaar.', empty: 'Er zijn nog geen roltoewijzingen.', error: 'Roltoewijzingen kunnen niet worden geladen.', back: 'Terug naar portalen', person: 'Gebruiker', portal: 'Portaal', role: 'Rol', status: 'Status', approved: 'Goedgekeurd', pending: 'In afwachting', revoked: 'Ingetrokken' },
  fr: { title: 'Rôles des portails', description: 'Aperçu des rôles attribués. Les modifications ne sont pas encore disponibles.', empty: 'Aucun rôle attribué.', error: 'Impossible de charger les rôles attribués.', back: 'Retour aux portails', person: 'Utilisateur', portal: 'Portail', role: 'Rôle', status: 'Statut', approved: 'Approuvé', pending: 'En attente', revoked: 'Révoqué' },
  en: { title: 'Portal roles', description: 'Overview of existing role assignments. Changes are not available yet.', empty: 'No role assignments yet.', error: 'Role assignments could not be loaded.', back: 'Back to portals', person: 'User', portal: 'Portal', role: 'Role', status: 'Status', approved: 'Approved', pending: 'Pending', revoked: 'Revoked' },
  de: { title: 'Portalrollen', description: 'Übersicht der bestehenden Rollenzuweisungen. Änderungen sind noch nicht verfügbar.', empty: 'Noch keine Rollenzuweisungen.', error: 'Rollenzuweisungen konnten nicht geladen werden.', back: 'Zurück zu den Portalen', person: 'Benutzer', portal: 'Portal', role: 'Rolle', status: 'Status', approved: 'Genehmigt', pending: 'Ausstehend', revoked: 'Widerrufen' },
} as const

export default async function PortalRolesPage() {
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  if (!current.isAdmin) redirect('/portals')

  // No service-role key: RLS remains authoritative, and no write operations are exposed.
  const supabase = await createClient()
  const { data, error } = await supabase.from('portal_role_assignments')
    .select('id,user_id,portal,role,approved,revoked_at')
    .order('created_at', { ascending: false }).limit(100)

  const t = translations.nl
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
