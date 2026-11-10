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

    // Refresh and validate the session server-side.
    const { data: { user } } = await supabase.auth.getUser()
    // Application pages are private by default. API routes remain responsible
    // for their own authentication/authorization so public auth/support APIs
    // can continue to operate without being accidentally hidden by middleware.
    if (!isPublicPath(pathname) && !user) {
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
    if (user && makerRoute) {
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

    // Keep login portals reachable while authenticated so admins/makers can
    // deliberately re-authenticate and switch their effective role mode.
    const redirectAuthenticatedAuthPages = ['/signup', '/forgot-password']
    const isRedirectedAuthPage = redirectAuthenticatedAuthPages.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    )

    if (isRedirectedAuthPage && user) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.search = ''
        const response = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
        return response
    }

    return supabaseResponse
}
