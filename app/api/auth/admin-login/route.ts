import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/crew-server'
import { sendSecurityLoginEmail } from '@/lib/security-login-email'

const MAKER_LOGIN_ALIAS = 'maker@uptilldawn'
const MAKER_ACCOUNT_EMAIL = 'steegmans.kyani@icloud.com'

function loginUrl(request: NextRequest, error?: string) {
  const url = new URL('/login/admin', request.url)
  if (error) url.searchParams.set('error', error)
  return url
}

async function adminRpc<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fn: string,
  args: Record<string, unknown>,
) {
  const rpc = supabase.rpc as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message?: string } | null }>
  return rpc(fn, args)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const submittedLogin = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  if (!submittedLogin || !password) {
    return NextResponse.redirect(loginUrl(request, 'E-mail en wachtwoord zijn verplicht.'), 303)
  }

  const email = submittedLogin === MAKER_LOGIN_ALIAS ? MAKER_ACCOUNT_EMAIL : submittedLogin
  const supabase = await createClient()
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null
  const approximateLocation = [
    request.headers.get('cf-ipcity'),
    request.headers.get('cf-region'),
    request.headers.get('cf-ipcountry'),
  ].filter(Boolean).join(', ') || null
  const userAgent = request.headers.get('user-agent')

  const notify = async (
    outcome: 'success' | 'failure' | 'blocked' | 'denied',
    reason: string,
  ) => {
    await sendSecurityLoginEmail({
      outcome,
      login: submittedLogin,
      canonicalLogin: email,
      portal: 'admin',
      ip,
      approximateLocation,
      userAgent,
      reason,
    }).catch(() => false)
  }

  const { data: guard, error: guardError } = await adminRpc<{ allowed?: boolean }>(
    supabase,
    'upt_admin_login_guard',
    { p_login: email },
  )

  if (guardError) {
    await notify('failure', 'security_guard_error')
    return NextResponse.redirect(loginUrl(request, 'Aanmelden tijdelijk niet beschikbaar. Probeer opnieuw.'), 303)
  }

  if (guard && guard.allowed === false) {
    await notify('blocked', 'login_locked')
    return NextResponse.redirect(loginUrl(request, 'Te veel mislukte aanmeldpogingen. Probeer over 15 minuten opnieuw.'), 303)
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    await adminRpc(supabase, 'upt_admin_login_failure', {
      p_login: email,
      p_ip: ip,
      p_location: approximateLocation,
      p_user_agent: userAgent,
    })
    await notify('failure', 'invalid_credentials')
    return NextResponse.redirect(loginUrl(request, 'Foute logingegevens of u heeft geen toegang tot deze rol.'), 303)
  }

  const [{ data: profile }, { data: isOwner }] = await Promise.all([
    supabase.from('profiles').select('approved, role').eq('id', data.user.id).single(),
    supabase.rpc('upt_current_is_owner'),
  ])

  const hasAdminAccess = Boolean(
    profile?.approved === true && (profile.role === 'admin' || isOwner === true),
  )

  if (!hasAdminAccess) {
    await notify('denied', 'wrong_portal')
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, 'Foute logingegevens of u heeft geen toegang tot deze rol.'), 303)
  }

  const { data: roleMode, error: roleModeError } = await supabase.rpc('upt_set_admin_role_mode', {
    p_role: 'admin',
  })

  if (roleModeError || roleMode !== 'admin') {
    await notify('denied', 'role_mode_error')
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, 'De beheerdermodus kon niet worden geactiveerd.'), 303)
  }

  await adminRpc(supabase, 'upt_admin_login_success', {
    p_login: email,
    p_ip: ip,
    p_location: approximateLocation,
    p_user_agent: userAgent,
  })
  await notify('success', 'login_success')

  const destination = submittedLogin === MAKER_LOGIN_ALIAS
    ? new URL('/maker-mode?portal=admin', request.url)
    : new URL('/admin', request.url)

  return NextResponse.redirect(destination, 303)
}
