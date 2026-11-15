import { notFound } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'

// Public login shells carry no account data. Pre-render them as static assets
// instead of invoking the full Next Worker for every anonymous login visit.
export const dynamic = 'force-static'
export const dynamicParams = false
export function generateStaticParams() {
  return [{ portal: 'staff' }, { portal: 'responsible' }]
}

type Portal = 'staff' | 'responsible' | 'admin'

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ portal: string }>
}) {
  const { portal } = await params
  if (portal !== 'staff' && portal !== 'responsible' && portal !== 'admin') notFound()

  return <LoginForm portal={portal as Portal} />
}
