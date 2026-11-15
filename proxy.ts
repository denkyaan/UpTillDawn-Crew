import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // These routes already bypass all Supabase session work in updateSession.
    // Keep Maker, private app pages, signup and password recovery protected.
    // On Workers Free, do not invoke a redundant proxy for public login/static
    // pages or API handlers which enforce their own access control.
    '/((?!api/|login(?:/|$)|auth/(?:callback|confirm|recovery|reset-password)(?:/|$)|disabled$|unauthorized$|verify-email$|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$|_next/static|_next/image|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
