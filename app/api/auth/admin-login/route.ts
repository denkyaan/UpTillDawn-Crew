import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/crew-server'
import { sendSecurityLoginEmail } from '@/lib/security-login-email'
import { isMakerLogin, resolveLoginEmail } from '@/lib/maker-login'

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
  let phase = 'form'
  try {
  const formData = await request.formData()
  const submittedLogin = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const makerLogin = isMakerLogin(submittedLogin)

  if (!submittedLogin || !password) {
    return NextResponse.redirect(loginUrl(request, 'E-mail en wachtwoord zijn verplicht.'), 303)
  }

  const email = resolveLoginEmail(submittedLogin)
  phase = 'supabase_client'
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
      ip: ip ?? undefined,
      approximateLocation: approximateLocation ?? undefined,
      userAgent: userAgent ?? undefined,
      reason,
    }).catch(() => false)
  }

  phase = 'password_auth'
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    await notify('failure', 'invalid_credentials')
    return NextResponse.redirect(loginUrl(request, 'Foute logingegevens of u heeft geen toegang tot deze rol.'), 303)
  }

  phase = 'admin_access'
  const [{ data: profileRows, error: profileError }, { data: isOwner }] = await Promise.all([
    supabase.rpc('upt_current_profile'),
    supabase.rpc('upt_current_is_owner'),
  ])
  const profile = profileRows?.[0] ?? null

  const hasAdminAccess = Boolean(
    isOwner === true || (!profileError && profile?.approved === true && profile.role === 'admin'),
  )

  if (!hasAdminAccess) {
    await notify('denied', 'wrong_portal')
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, 'Foute logingegevens of u heeft geen toegang tot deze rol.'), 303)
  }

  phase = 'role_mode'
  const { data: roleMode, error: roleModeError } = await supabase.rpc('upt_set_admin_role_mode', {
    p_role: 'admin',
  })

  if (roleModeError || roleMode !== 'admin') {
    await notify('denied', 'role_mode_error')
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, 'De beheerdermodus kon niet worden geactiveerd.'), 303)
  }

  phase = 'success_audit'
  try {
    await supabase.rpc('upt_admin_login_success', {
      p_login: email,
      p_ip: ip ?? undefined,
      p_location: approximateLocation ?? undefined,
      p_user_agent: userAgent ?? undefined,
    })
  } catch (auditError) {
    console.error('[admin-login] success audit failed', {
      message: auditError instanceof Error ? auditError.message : String(auditError),
    })
  }

  try {
    await notify('success', 'login_success')
  } catch (notifyError) {
    console.error('[admin-login] success notification failed', {
      message: notifyError instanceof Error ? notifyError.message : String(notifyError),
    })
  }

  phase = 'redirect'
  const destination = isOwner === true
    ? new URL('/maker-mode?portal=admin', request.url)
    : new URL('/admin', request.url)

  return NextResponse.redirect(destination, 303)
  } catch (error) {
    console.error('[admin-login] unhandled failure', {
      phase,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(
      loginUrl(request, `Admin-login kon niet worden verwerkt (fase: ${phase}). Probeer opnieuw.`),
      303,
    )
  }
}
