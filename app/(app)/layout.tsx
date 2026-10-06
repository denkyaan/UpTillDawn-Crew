import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { ReturnAfterLogin } from '@/components/auth/return-after-login'
import { GlobalOfflineContentSync } from '@/components/crew/global-offline-content-sync'
import { ErrorReportBridge } from '@/components/error-report-bridge'
import { getCurrentUser } from '@/lib/actions/auth'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
 const current = await getCurrentUser()
 if (!current) redirect('/login')
 const user = { id: current.id }


 return <AppLayout><ReturnAfterLogin /><GlobalOfflineContentSync userId={user.id}/><ErrorReportBridge/>{children}</AppLayout>
}
