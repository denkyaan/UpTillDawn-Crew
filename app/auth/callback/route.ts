import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/crew-server'

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
])

function safeInternalPath(value: string | null, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  return value
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const supabase = await createClient()
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const rawType = params.get('type')
  const type = rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType)
    ? rawType as EmailOtpType
    : null

  let error: unknown = params.get('error')

  if (!error && code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  } else if (!error && tokenHash && type) {
    ;({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }))
  } else {
    error = true
  }

  const requested = safeInternalPath(params.get('next'))
  const isRecovery = type === 'recovery' || params.get('next') === '/auth/reset-password'

  if (error) {
    const target = isRecovery
      ? '/forgot-password?error=invalid_or_expired'
      : '/verify-email?error=De%20link%20is%20ongeldig%20of%20verlopen.'
    return NextResponse.redirect(new URL(target, request.nextUrl.origin))
  }

  if (isRecovery) {
    return NextResponse.redirect(new URL('/auth/reset-password', request.nextUrl.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved,account_blocked')
      .eq('id', user.id)
      .single()

    if (profile?.account_blocked) {
      return NextResponse.redirect(new URL('/disabled', request.nextUrl.origin))
    }
    if (profile && !profile.approved) {
      return NextResponse.redirect(new URL('/pending-approval', request.nextUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(requested, request.nextUrl.origin))
}
