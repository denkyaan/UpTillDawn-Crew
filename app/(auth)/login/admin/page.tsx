import { LoginForm } from '@/components/auth/login-form'

// Public Admin login has no private content. Only the POST handler performs
// authentication and authorization. Avoid Next SSR for anonymous GETs on Main.
export const dynamic = 'force-static'

export default function AdminLoginPage() {
  return <LoginForm portal="admin" />
}
