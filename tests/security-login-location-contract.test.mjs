import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/auth/admin-login/route.ts', import.meta.url), 'utf8')
const email = readFileSync(new URL('../lib/security-login-email.ts', import.meta.url), 'utf8')

test('admin login passes Cloudflare approximate coordinates into the alert', () => {
  assert.match(route, /request\.headers\.get\('cf-iplatitude'\)/)
  assert.match(route, /request\.headers\.get\('cf-iplongitude'\)/)
  assert.match(route, /latitude: latitude \?\? undefined/)
  assert.match(route, /longitude: longitude \?\? undefined/)
})

test('security alert validates both coordinates and geographic bounds', () => {
  assert.match(email, /Number\.isFinite\(lat\)/)
  assert.match(email, /Number\.isFinite\(lon\)/)
  assert.match(email, /lat < -90 \|\| lat > 90/)
  assert.match(email, /lon < -180 \|\| lon > 180/)
})

test('alert clearly labels approximate IP location and links to map only when present', () => {
  assert.match(email, /IP-geolocatiecoördinaten \(benadering\)/)
  assert.match(email, /coordinates \? `<tr>/)
  assert.match(email, /https:\/\/www\.google\.com\/maps\?q=/)
  assert.match(email, /niet beschikbaar/)
  assert.match(email, /escapeHtml\(coordinates\.url\)/)
})


test('full production CI runs on main pushes but not on pull requests', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const triggers = workflow.split(/^on:\s*$/m)[1]?.split(/^\S/m)[0] || ''
  assert.match(triggers, /^\s+workflow_dispatch:/m)
  assert.match(triggers, /^\s+workflow_call:/m)
  assert.doesNotMatch(triggers, /^\s+(?:push|pull_request|schedule):/m)
})

test('admin login checks and logs RPC audit errors without failing authentication', () => {
  assert.match(route, /const \{ error: auditError \} = await supabase\.rpc\('upt_admin_login_success'/)
  assert.match(route, /if \(auditError\) \{/)
  assert.match(route, /success audit rejected/)
})
