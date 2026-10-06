import { notFound } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'

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
