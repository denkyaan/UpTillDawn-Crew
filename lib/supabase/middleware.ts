// ============================================================
// Supabase Middleware — Refreshes auth sessions on every request
// Required for SSR auth to work correctly with Next.js App Router
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_EXACT_PATHS = new Set([
    '/login',
    '/signup',
    '/forgot-password',
    '/auth/reset-password',
    '/auth/recovery',
    '/auth/confirm',
    '/verify-email',
    '/disabled',
    '/unauthorized',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/icon.png',
])

const PUBLIC_PREFIXES = [
    '/login/',
    '/auth/callback',
    '/api/',
]

function isPublicPath(pathname: string) {
    return PUBLIC_EXACT_PATHS.has(pathname) ||
        PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export async function updateSession(request: NextRequest) {
    // Login and API routes handle their own authorization. Avoid an unnecessary
    // Supabase auth request on every public page, API call and login attempt.
    // Signup/password recovery keep the existing authenticated redirect below.
    const pathname = request.nextUrl.pathname
    if (isPublicPath(pathname) &&
        pathname !== '/signup' && !pathname.startsWith('/signup/') &&
        pathname !== '/forgot-password' && !pathname.startsWith('/forgot-password/')) {
        return NextResponse.next({ request })
    }

    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                )
                supabaseResponse = NextResponse.next({ request })
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                )
            },
        },
    })

    // Verify signed claims without an extra Auth user-record network call
    // for each navigation. Live database permissions remain authoritative.
    const { data: verified, error: claimsError } = await supabase.auth.getClaims()
    const authenticated = !claimsError && typeof verified?.claims?.sub === 'string'
    // Application pages are private by default. API routes remain responsible
    // for their own authentication/authorization so public auth/support APIs
    // can continue to operate without being accidentally hidden by middleware.
    if (!isPublicPath(pathname) && !authenticated) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        const response = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
        return response
    }

    // Enforce Maker ownership before Next.js starts the protected RSC render.
    // This avoids leaking a partial God Mode shell to a signed-in non-owner;
    // all privileged RPCs still independently validate their Maker session.
    const makerRoute = pathname === '/maker-mode' || pathname.startsWith('/maker-mode/') ||
        pathname === '/god-mode' || pathname.startsWith('/god-mode/')
    if (authenticated && makerRoute) {
        const { data: isOwner, error: ownerError } = await supabase.rpc('upt_current_is_owner')
        if (ownerError || isOwner !== true) {
            const url = request.nextUrl.clone()
            url.pathname = '/unauthorized'
            url.search = ''
            const response = NextResponse.redirect(url)
            supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
            return response
        }
    }

    // Short-circuit two expensive protected SSR surfaces for sessions with
    // insufficient roles. A denied browser navigation must NOT enter a full
    // Next.js RSC render (Cloudflare Free can fail with 1102 before redirect).
    // Read permission only from authenticated, database-backed RPCs, never
    // from client-selected portal cookies or mutable client role fields.
    // The page/layout still re-checks authorization for allowed requests.
    const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/')
    const isFinanceArea = pathname === '/portals/administration/finance' ||
        pathname.startsWith('/portals/administration/finance/')
    if (authenticated && (isAdminArea || isFinanceArea)) {
        const redirectDenied = (destination: string) => {
            const url = request.nextUrl.clone()
            url.pathname = destination
            url.search = ''
            const response = NextResponse.redirect(url)
            supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
            return response
        }
        const authzUnavailable = () => {
            const response = new NextResponse(
                'Authorization service temporarily unavailable.',
                { status: 503, headers: { 'Cache-Control': 'no-store' } },
            )
            supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
            return response
        }
        if (isAdminArea) {
            // Equivalent to getCurrentUser().isAdmin: effective role, not
            // permanent DB role. A Maker in Staff preview mode remains denied.
            const { data: effectiveRole, error } = await supabase.rpc('upt_current_effective_role')
            if (error) return authzUnavailable()
            if (effectiveRole !== 'admin') return redirectDenied('/')
        } else {
            // Finance is shared by permanent Admin, Maker and explicitly
            // approved Administration portal users (including deputies).
            const [{ data: profileRows, error: profileError },
                { data: owner, error: ownerError }] = await Promise.all([
                supabase.rpc('upt_current_profile'),
                supabase.rpc('upt_current_is_owner'),
            ])
            if (profileError || ownerError) return authzUnavailable()
            const profile = profileRows?.[0] ?? null
            const active = Boolean(profile?.approved && !profile?.account_blocked)
            if (!owner && (!active || profile?.role !== 'admin')) {
                if (!active) return redirectDenied('/portals')
                const { data: assignments, error } = await supabase.rpc('upt_my_portal_assignments')
                if (error) return authzUnavailable()
                const allowed = (assignments ?? []).some((assignment: { portal: string; approved: boolean; revoked_at: string | null }) =>
                    assignment.portal === 'administration' &&
                    assignment.approved === true &&
                    assignment.revoked_at == null,
                )
                if (!allowed) return redirectDenied('/portals')
            }
        }
    }

    // Keep login portals reachable while authenticated so admins/makers can
    // deliberately re-authenticate and switch their effective role mode.
    const redirectAuthenticatedAuthPages = ['/signup', '/forgot-password']
    const isRedirectedAuthPage = redirectAuthenticatedAuthPages.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    )

    if (isRedirectedAuthPage && authenticated) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.search = ''
        const response = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
        return response
    }

    return supabaseResponse
}
