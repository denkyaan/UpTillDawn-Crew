import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { userVisiblePortals, type Portal, type PortalAssignment } from "@/lib/portal-access"

const destinations: Record<Portal, string> = {
  events: "/",
  promotion: "/portals/promotion",
  administration: "/portals/administration",
}

/**
 * Keep portal-switch redirects relative to the browser's current origin.
 * The server's request.url can use an internal host (e.g. localhost), while
 * a browser is authenticated on 127.0.0.1. Redirecting to that internal host
 * drops the origin-scoped Supabase cookies and falsely signs the user out.
 *
 * All paths here are fixed application paths, never supplied by a client.
 */
function redirectOnCurrentOrigin(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params
  const user = await getCurrentUser()
  if (!user) return redirectOnCurrentOrigin("/login")
  if (!Object.hasOwn(destinations, portal)) return redirectOnCurrentOrigin("/portals")

  const { data, error } = await (await createClient()).rpc("upt_my_portal_assignments")
  // An RPC failure must not grant delegated portal roles. Keep only established
  // permanent Admin/Owner and event access when the assignment service fails.
  const allowed = userVisiblePortals(error ? [] : (data ?? []) as PortalAssignment[], {
    approved: user.approved,
    blocked: user.account_blocked === true,
    isOwner: user.isOwner,
    realIsAdmin: user.realIsAdmin,
    role: user.role,
  })

  if (allowed.includes(portal as Portal)) {
    const response = redirectOnCurrentOrigin(destinations[portal as Portal])
    response.cookies.set("uptilldawn-last-portal", portal, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    })
    return response
  }

  return redirectOnCurrentOrigin("/portals")
}
