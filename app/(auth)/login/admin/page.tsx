import { LoginForm } from '@/components/auth/login-form'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  return <LoginForm portal="admin" nativeAction="/api/auth/admin-login" initialError={error} />
}
