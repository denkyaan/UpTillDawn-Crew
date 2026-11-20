import ForgotPasswordForm from '@/components/auth/forgot-password-form'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams
  const initialError = params.error === 'invalid_or_expired'
    ? 'De herstel-link is ongeldig of verlopen. Vraag hieronder een nieuwe herstel-link aan.'
    : null

  return <ForgotPasswordForm initialError={initialError} />
}
