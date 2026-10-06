'use server'

import { redirect } from 'next/navigation'

// The standalone password entry point is retired. God Mode can only be opened
// from an authenticated permanent-maker session via Maker Mode.
export async function signInGodMode() {
  redirect('/login/admin')
}
