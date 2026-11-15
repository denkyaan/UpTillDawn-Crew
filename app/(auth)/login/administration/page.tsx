import { LoginForm } from '@/components/auth/login-form'

export const dynamic = 'force-static'

export default function AdministrationLoginPage() {
  return <LoginForm portal="administration" />
}
