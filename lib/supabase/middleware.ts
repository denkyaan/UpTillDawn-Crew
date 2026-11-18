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

    // The shared Worker hosts every protected Next SSR route. Anonymous
    // navigation must not spend the Workers Free CPU budget creating an SSR
    // Supabase client and decoding/verifying an access token that is absent.
    // Presence is only a fast-path NEGATIVE check: a present/forged cookie
    // continues through getClaims() and database authorization as before.
    // Session cookies may be chunked by @supabase/ssr (auth-token.0, .1...).
    const hasSessionCookie = request.cookies.getAll().some(cookie =>
        /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(cookie.name) &&
        cookie.value.length > 0,
    )
    if (!hasSessionCookie) {
        // Signup and password recovery are intentionally reachable without
        // a session; only an actually authenticated session should redirect.
        if (pathname === '/signup' || pathname.startsWith('/signup/') ||
            pathname === '/forgot-password' || pathname.startsWith('/forgot-password/')) {
            return NextResponse.next({ request })
        }
        const login = request.nextUrl.clone()
        login.pathname = '/login'
        login.search = ''
        return NextResponse.redirect(login)
    }


    // All ordinary (app) pages are wrapped by AuthenticatedLayout, which
    // awaits getCurrentUser() BEFORE returning the protected shell. That
    // request-scoped call uses upt_current_session_context(): PostgREST checks
    // the signed bearer JWT and the self-scoped database privileges. Avoid
    // verifying the same JWT a second time in this Free-tier edge middleware.
    //
    // CRITICAL: This is a strict allowlist for PAGE routes only. Admin and
    // finance have separate early DB role enforcement below; Maker routes,
    // public auth flows and App Router route handlers must keep this middleware.
    const appPageRoots = [
        '/audit', '/briefings', '/chat', '/crew', '/events', '/exports',
        '/guestlist', '/help', '/incidents', '/inventory', '/notifications',
        '/onboarding', '/operations', '/personnel', '/sales', '/settings',
        '/shifts', '/sync', '/tasks', '/timesheets', '/workplaces',
    ]
    const ordinaryAppPage = pathname === '/' ||
        appPageRoots.some(root => pathname === root || pathname.startsWith(root + '/')) ||
        pathname === '/portals' ||
        pathname === '/portals/roles' ||
        pathname.startsWith('/portals/promotion/') ||
        pathname === '/portals/promotion' ||
        pathname === '/portals/administration' ||
        pathname.startsWith('/portals/administration/')
    // Finance GET is a known expensive SSR route. Deny unrelated staff
    // BEFORE the full Next render using one authenticated database permission
    // RPC (not the previous 2-3 independent checks). This avoids spending
    // the Workers Free CPU budget rendering a page that must redirect anyway.
    // The Administration layout still independently authorizes allowed pages.
    const isFinanceArea = pathname === '/portals/administration/finance' ||
        pathname.startsWith('/portals/administration/finance/')
    const requiresEarlyRoleCheck =
        pathname === '/admin' || pathname.startsWith('/admin/') || isFinanceArea
    const routeHandlerWithoutAppLayout =
        pathname.startsWith('/portals/switch/') ||
        /^\/portals\/administration\/modules\/artists\/[^/]+\/agreement\/(?:archive|print)\//.test(pathname)
    // Never bypass the proxy on POST/PUT/etc: Next server actions are
    // delivered to page URLs and must retain the usual edge verification.
    const safeRead = request.method === 'GET' || request.method === 'HEAD'
    if (safeRead && ordinaryAppPage && !requiresEarlyRoleCheck && !routeHandlerWithoutAppLayout) {
        // No auth is granted here: AuthenticatedLayout + signed PostgREST
        // session context still fail closed before any private page renders.
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
            // Single self-scoped, SECURITY DEFINER boolean RPC reads the
            // *verified* session (auth.uid), approval, Admin/Maker status and
            // active Administration entitlement. Never trust role cookies.
            // This avoids SSR of the expensive financial page for Staff.
            // Network/DB errors remain 503 (not an incorrect 'denied' PASS).
            const { data: canManage, error } = await supabase.rpc('upt_can_manage_administration')
            if (error) return authzUnavailable()
            if (canManage !== true) return redirectDenied('/portals')
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
