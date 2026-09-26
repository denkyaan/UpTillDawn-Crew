import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { AppLayout } from '@/components/layout/app-layout'
import { ReturnAfterLogin } from '@/components/auth/return-after-login'
import { GlobalOfflineContentSync } from '@/components/crew/global-offline-content-sync'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
 const s = await createClient()
 const { data: { user } } = await s.auth.getUser()
 if (!user) redirect('/login')

 const { data: p, error } = await s.from('profiles').select('approved').eq('id', user.id).single()
 if (error || !p) return <main className="p-8">Je profiel kon niet worden geladen. Probeer opnieuw.</main>
 if (!p.approved) return <main className="p-8">ACCOUNT NOG NIET GOEDGEKEURD</main>

 return <AppLayout><ReturnAfterLogin /><GlobalOfflineContentSync userId={user.id}/>{children}</AppLayout>
}
