import { redirect } from 'next/navigation'
import { PortalSwitcher } from '@/components/layout/portal-switcher'
import { LazyAppLayout } from '@/components/layout/lazy-app-layout'
import { ReturnAfterLogin } from '@/components/auth/return-after-login'
import { LazyOfflineContentSync } from '@/components/crew/lazy-offline-content-sync'
import { ErrorReportBridge } from '@/components/error-report-bridge'
import { getCurrentUser } from '@/lib/actions/auth'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 const user = { id: current.id }


 return <LazyAppLayout><ReturnAfterLogin /><PortalSwitcher /><LazyOfflineContentSync userId={user.id}/><ErrorReportBridge/>{children}</LazyAppLayout>
}
