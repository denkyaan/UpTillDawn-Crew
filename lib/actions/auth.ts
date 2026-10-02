// ============================================================
// Auth Actions — Server Actions (App Router)
// All domain validation and session logic lives here.
// These run SERVER-SIDE only — never expose to client directly.
// ============================================================

'use server'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/crew-server'
import { passwordPolicyMessage } from '@/lib/password-policy'
import { sendSecurityLoginEmail } from '@/lib/security-login-email'
import { markSaveSuccess } from '@/lib/save-success'

const MAKER_LOGIN_ALIAS = 'maker@uptilldawn'
const MAKER_ACCOUNT_EMAIL = 'steegmans.kyani@icloud.com'

function resolveLoginEmail(email: string) {
    return email === MAKER_LOGIN_ALIAS ? MAKER_ACCOUNT_EMAIL : email
}

function extractName(email: string): string {
    const local = email.split('@')[0]
    return local.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ').slice(0, 200)
}

function appOrigin(): string | null {
    const raw = process.env.NEXT_PUBLIC_APP_URL
    if (!raw) return null
    try {
        const url = new URL(raw)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
    } catch { return null }
}

async function lookupIpLocation(ip: string | null) {
    const apiKey = process.env.GEOAPIFY_API_KEY
    if (!apiKey || !ip) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    try {
        const url = new URL('https://api.geoapify.com/v1/ipinfo')
        url.searchParams.set('ip', ip)
        url.searchParams.set('apiKey', apiKey)
        url.searchParams.set('lang', 'nl')

        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) return null

        const payload = await response.json() as {
            city?: { name?: string }
            state?: { name?: string }
            country?: { name?: string }
            postcode?: string
        }
        const parts = [
            payload.city?.name,
            payload.postcode,
            payload.state?.name,
            payload.country?.name,
        ].filter((value): value is string => Boolean(value))
        return parts.join(', ') || null
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}

async function requestSecurityContext() {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = h.get('cf-connecting-ip') || forwarded || h.get('x-real-ip') || null
    const city = h.get('cf-ipcity')
    const region = h.get('cf-region')
    const country = h.get('cf-ipcountry')
    const cloudflareLocation = [city, region, country].filter(Boolean).join(', ') || null
    const approximateLocation = cloudflareLocation || await lookupIpLocation(ip)
    return { ip, approximateLocation, userAgent: h.get('user-agent') }
}

// The admin-login security migration can be newer than a checked-in generated
// Supabase type snapshot. Keep this small compatibility wrapper isolated here;
// regenerate crew-database.ts from the deployed schema when available.
async function adminSecurityRpc<T>(supabase: Awaited<ReturnType<typeof createClient>>, fn: string, args: Record<string, unknown>) {
    const rpc = supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: T | null; error: { message?: string } | null }>
    return rpc(fn, args)
}


function signUpError(error: { code?: string; status?: number; message?: string }) {
    const code = String(error.code || '').toLowerCase()
    const message = String(error.message || '').toLowerCase()

    if (
        code === 'user_already_exists' ||
        code === 'email_exists' ||
        message.includes('already registered') ||
        message.includes('already been registered')
    ) {
        return {
            error: 'Er bestaat al een account met dit e-mailadres. Log in of gebruik wachtwoord herstellen.',
            code: 'account_exists',
        }
    }

    if (
        code === 'over_email_send_rate_limit' ||
        error.status === 429 ||
        message.includes('rate limit')
    ) {
        return {
            error: 'De verificatiemail kan nu niet worden verzonden omdat de e-maildienst tijdelijk te veel verzoeken ontvangt. Wacht enkele minuten en probeer opnieuw.',
            code: 'email_rate_limit',
        }
    }

    if (
        code === 'unexpected_failure' &&
        (
            message.includes('send email') ||
            message.includes('smtp') ||
            message.includes('gomail') ||
            message.includes('testing emails') ||
            message.includes('verify a domain')
        )
    ) {
        return {
            error: 'Registratie kan niet worden afgerond omdat de verificatiemail niet kan worden verzonden. De e-maildienst staat momenteel in testmodus en accepteert nog niet alle e-mailadressen. Neem contact op met de beheerder of probeer een toegestaan testadres.',
            code: 'email_delivery_test_mode',
        }
    }

    if (
        code === 'email_address_invalid' ||
        code === 'validation_failed' ||
        message.includes('invalid email')
    ) {
        return {
            error: 'Dit e-mailadres is niet geldig. Controleer het adres en probeer opnieuw.',
            code: 'invalid_email',
        }
    }

    if (code === 'weak_password' || message.includes('password')) {
        return {
            error: 'Het wachtwoord voldoet niet aan de beveiligingsvereisten. Kies een sterker wachtwoord en probeer opnieuw.',
            code: 'weak_password',
        }
    }

    if (code === 'signup_disabled' || message.includes('signups not allowed') || message.includes('signup is disabled')) {
        return {
            error: 'Nieuwe registraties zijn momenteel uitgeschakeld. Neem contact op met de beheerder.',
            code: 'signup_disabled',
        }
    }

    if (code === 'captcha_failed' || message.includes('captcha')) {
        return {
            error: 'De beveiligingscontrole is mislukt. Vernieuw de pagina en probeer opnieuw.',
            code: 'captcha_failed',
        }
    }

    return {
        error: 'Registratie is mislukt door een technische fout bij de authenticatieservice. Probeer opnieuw; blijft dit gebeuren, meld foutcode signup_auth_error aan de beheerder.',
        code: code || 'signup_auth_error',
    }
}

// ── Sign Up ──────────────────────────────────────────────────
export async function signUp(formData: FormData) {
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirm_password') || '')
    const fullName = String(formData.get('full_name') || '').trim() || extractName(email)
    if (!email || !password) return { error: 'E-mail en wachtwoord zijn verplicht.' }
    if (!fullName || fullName.length > 200) return { error: 'Volledige naam moet tussen 1 en 200 tekens bevatten.' }
    const passwordError = passwordPolicyMessage(password)
    if (passwordError) return { error: passwordError }
    if (confirmPassword && password !== confirmPassword) return { error: 'Wachtwoorden komen niet overeen.' }
    const origin = appOrigin()
    if (!origin) return { error: 'De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder.' }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback`, data: { full_name: fullName, pwa_install_prompt_pending: true } } })
    if (error) return signUpError(error)
    return {
        success: true,
        redirectTo: data.session ? '/pending-approval' : '/verify-email',
        userId: data.user?.id,
    }
}

// ── Sign In ──────────────────────────────────────────────────
export async function signIn(formData: FormData) {
    const submittedEmail = String(formData.get('email') || '').trim().toLowerCase()
    const email = resolveLoginEmail(submittedEmail)
    const password = String(formData.get('password') || '')
    const requestedPortal = String(formData.get('portal') || 'staff').toLowerCase()
    if (!['staff', 'responsible', 'admin'].includes(requestedPortal)) return { error: 'Ongeldig inlogportaal.', code: 'invalid_portal' }
    if (!submittedEmail || !password) return { error: 'E-mail en wachtwoord zijn verplicht.' }

    const supabase = await createClient()

    const securityRelevant = requestedPortal === 'admin'
    let security = securityRelevant ? await requestSecurityContext() : null
    const getSecurity = async () => {
        if (!security) security = await requestSecurityContext()
        return security
    }
    const notifySecurity = async (outcome: 'success' | 'failure' | 'blocked' | 'denied', reason?: string) => {
        if (!securityRelevant) return
        const context = await getSecurity()
        await sendSecurityLoginEmail({
            outcome,
            login: submittedEmail,
            canonicalLogin: email,
            portal: requestedPortal as 'staff' | 'responsible' | 'admin',
            ip: context.ip,
            approximateLocation: context.approximateLocation,
            userAgent: context.userAgent,
            reason: reason ?? null,
        })
    }
    if (requestedPortal === 'admin') {
        const { data: guard, error: guardError } = await adminSecurityRpc<{ allowed?: boolean }>(supabase, 'upt_admin_login_guard', { p_login: email })
        if (guardError) {
            await notifySecurity('failure', 'security_guard_error')
            return { error: 'Aanmelden tijdelijk niet beschikbaar. Probeer opnieuw.', code: 'security_guard_error' }
        }
        if (guard && guard.allowed === false) {
            await notifySecurity('blocked', 'login_locked')
            return { error: 'Te veel mislukte aanmeldpogingen. Probeer over 15 minuten opnieuw.', code: 'login_locked' }
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
        if (requestedPortal === 'admin') {
            await adminSecurityRpc(supabase, 'upt_admin_login_failure', { p_login: email, p_ip: security?.ip ?? null, p_location: security?.approximateLocation ?? null, p_user_agent: security?.userAgent ?? null })
        }
        await notifySecurity('failure', error?.message.includes('Email not confirmed') ? 'email_not_confirmed' : error?.message.includes('Invalid login credentials') ? 'invalid_credentials' : 'auth_failure')
        if (requestedPortal === 'admin' || requestedPortal === 'responsible') return { error: 'Foute logingegevens of u heeft geen toegang tot deze rol.', code: 'invalid_credentials_or_role' }
        if (error?.message.includes('Email not confirmed')) return { error: 'Verifieer eerst je e-mailadres.', code: 'email_not_confirmed' }
        if (error?.message.includes('Invalid login credentials')) return { error: 'Onjuist e-mailadres of wachtwoord.', code: 'invalid_credentials' }
        return { error: 'Aanmelden mislukt. Probeer opnieuw.' }
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('approved, role, account_blocked').eq('id', data.user.id).single()
    if (profileError || !profile) { await notifySecurity('denied', 'profile_error'); await supabase.auth.signOut(); return { error: 'Je profiel kon niet worden geladen. Probeer opnieuw.', code: 'profile_error' } }
    if (profile.account_blocked) { await notifySecurity('denied', 'account_blocked'); await supabase.auth.signOut(); return { error: 'ACCOUNT GEBLOKKEERD', code: 'account_blocked' } }
    const { data: isOwner } = await supabase.rpc('upt_current_is_owner')
    if (!profile.approved && !isOwner) {
        await notifySecurity('denied', 'account_not_approved')
        if (requestedPortal === 'staff') {
            return { success: true, redirectTo: '/pending-approval', code: 'account_not_approved' }
        }
        await supabase.auth.signOut()
        return { error: 'ACCOUNT NOG NIET GOEDGEKEURD', code: 'account_not_approved' }
    }

    const role = profile.role
    const hasPermanentAdminAccess = role === 'admin' || isOwner === true
    const allowed = requestedPortal === 'admin' ? hasPermanentAdminAccess : requestedPortal === 'responsible' ? role === 'responsible_lead' || hasPermanentAdminAccess : role === 'staff' || role === 'responsible_lead' || hasPermanentAdminAccess
    if (!allowed) {
        if (requestedPortal === 'admin') await adminSecurityRpc(supabase, 'upt_admin_login_failure', { p_login: email, p_ip: security?.ip ?? null, p_location: security?.approximateLocation ?? null, p_user_agent: security?.userAgent ?? null })
        await notifySecurity('denied', 'wrong_portal')
        await supabase.auth.signOut()
        return { error: requestedPortal === 'admin' || requestedPortal === 'responsible' ? 'Foute logingegevens of u heeft geen toegang tot deze rol.' : 'Dit account heeft geen toegang tot het gekozen portaal.', code: 'wrong_portal' }
    }

    if (hasPermanentAdminAccess) {
        const requestedRoleMode = requestedPortal === 'admin' ? 'admin' : requestedPortal === 'responsible' ? 'responsible_lead' : 'staff'
        const { data: roleMode, error: roleModeError } = await supabase.rpc('upt_set_admin_role_mode', { p_role: requestedRoleMode })
        if (roleModeError || roleMode !== requestedRoleMode) { await notifySecurity('denied', 'role_mode_error'); await supabase.auth.signOut(); return { error: 'De gekozen rolweergave kon niet worden geactiveerd.', code: 'role_mode_error' } }
    }

    if (requestedPortal === 'admin') {
        const context = await getSecurity()
        await adminSecurityRpc(supabase, 'upt_admin_login_success', { p_login: email, p_ip: context.ip ?? null, p_location: context.approximateLocation ?? null, p_user_agent: context.userAgent ?? null })
    }

    await notifySecurity('success', 'login_success')

    const redirectTo = submittedEmail === MAKER_LOGIN_ALIAS && requestedPortal === 'admin'
        ? '/maker-mode?portal=admin'
        : requestedPortal === 'admin'
            ? '/admin'
            : '/'

    return { success: true, redirectTo }
}

export async function signInAdmin(formData: FormData) {
    const adminForm = new FormData()
    adminForm.set('email', String(formData.get('email') || ''))
    adminForm.set('password', String(formData.get('password') || ''))
    adminForm.set('portal', 'admin')

    const result = await signIn(adminForm)
    if (result?.error) {
        const params = new URLSearchParams({ error: result.error })
        redirect(`/login/admin?${params.toString()}`)
    }

    redirect(result?.redirectTo || '/admin')
}

// ── Sign Out ──────────────────────────────────────────────────
export async function signOut() {
    const supabase = await createClient(); await supabase.auth.signOut()
    const cookieStore = await cookies(); cookieStore.delete('uptilldawn-admin-edit-mode'); cookieStore.delete('uptilldawn-admin-edit-role'); redirect('/login')
}

// ── Forgot Password ──────────────────────────────────────────
export async function forgotPassword(formData: FormData) {
    const submittedEmail = String(formData.get('email') || '').trim().toLowerCase(); if (!submittedEmail) return { error: 'Vul je e-mailadres in.' }
    const email = resolveLoginEmail(submittedEmail)
    const origin = appOrigin(); if (!origin) return { error: 'De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder.' }
    const supabase = await createClient(); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/reset-password` })
    if (error) {
        if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.message.toLowerCase().includes('rate limit')) {
            return { error: 'Er is zojuist al een herstelmail verstuurd. Wacht even en gebruik de meest recente herstelmail in je inbox.' }
        }
        return { error: 'De herstelmail kon niet worden verstuurd. Probeer het later opnieuw.' }
    }
    return { success: true, message: 'Als dit account bestaat, is een herstel-link naar het e-mailadres verstuurd.' }
}

// ── Update Password ──────────────────────────────────────────
export async function updatePassword(formData: FormData) {
    const password = String(formData.get('password') || ''); const confirmPassword = String(formData.get('confirm_password') || '')
    if (password !== confirmPassword) return { error: 'Wachtwoorden komen niet overeen.' }
    const passwordError = passwordPolicyMessage(password)
    if (passwordError) return { error: passwordError }
    const supabase = await createClient(); const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'De herstel-link is ongeldig of verlopen. Vraag een nieuwe herstel-link aan.' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        if (error.code === 'same_password' || error.message.toLowerCase().includes('different from the old password')) {
            return { error: 'Je nieuwe wachtwoord moet verschillen van je huidige wachtwoord.' }
        }
        if (error.code === 'weak_password') {
            return { error: 'Dit wachtwoord wordt door de beveiligingsregels geweigerd. Kies een sterker en uniek wachtwoord.' }
        }
        return { error: 'Het wachtwoord kon niet worden gewijzigd. Probeer opnieuw.' }
    }
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' }); if (signOutError) await supabase.auth.signOut({ scope: 'local' })
    const cookieStore = await cookies(); cookieStore.delete('uptilldawn-admin-edit-mode'); cookieStore.delete('uptilldawn-admin-edit-role')
    await markSaveSuccess()
    return { success: true, message: 'Wachtwoord is bijgewerkt. Log opnieuw in.' }
}

// ── Resend Verification Email ────────────────────────────────
export async function resendVerificationEmail(formData: FormData) {
    const submittedEmail = String(formData.get('email') || '').trim().toLowerCase(); if (!submittedEmail) return { error: 'Vul je e-mailadres in.' }
    const email = resolveLoginEmail(submittedEmail)
    const origin = appOrigin(); if (!origin) return { error: 'De applicatieconfiguratie is onvolledig. Neem contact op met de beheerder.' }
    const supabase = await createClient(); const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/callback` } })
    if (error) return { error: 'De verificatiemail kon niet worden verstuurd. Probeer opnieuw.' }
    return { success: true, message: 'Verificatiemail opnieuw verstuurd.' }
}

// ── Get Current User with Profile ────────────────────────────
export const getCurrentUser = cache(async function getCurrentUser() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return null

    const [{ data: profile, error }, { data: isOwner }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,phone_number,profile_photo_url,approved,role,account_blocked').eq('id', user.id).single(),
        supabase.rpc('upt_current_is_owner'),
    ])
    if (error || !profile || profile.account_blocked || (!profile.approved && !isOwner)) return null

    const realRole = profile.role
    const hasPermanentAdminAccess = realRole === 'admin' || isOwner === true
    const { data: storedRole } = hasPermanentAdminAccess
        ? await supabase.rpc('upt_current_effective_role')
        : { data: realRole }
    const effectiveRole = storedRole === 'responsible_lead'
        ? 'responsible_lead'
        : storedRole === 'staff'
            ? 'staff'
            : storedRole === 'admin'
                ? 'admin'
                : realRole
    const roles = [effectiveRole === 'staff' ? 'employee' : effectiveRole]

    return {
        ...profile,
        approved: profile.approved || isOwner === true,
        role: effectiveRole,
        realRole,
        roleMode: effectiveRole,
        id: user.id,
        email: user.email ?? '',
        roles,
        isAdmin: effectiveRole === 'admin',
        realIsAdmin: hasPermanentAdminAccess,
        isOwner: isOwner === true,
        isEditMode: false,
    }
})

export async function verifyAdminSettingsCode() {
    return { ok: false, error: 'De oude PIN-editor is verwijderd. Gebruik God Mode.' }
}
