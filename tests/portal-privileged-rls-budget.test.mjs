import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const portal = readFileSync('app/(app)/portals/[portal]/page.tsx','utf8')

test('privileged Administration and Promotion pages avoid a redundant role RPC',()=>{
  assert.ok(portal.includes("const { data, error } = !current.realIsAdmin && !current.isOwner"))
  assert.ok(portal.includes("? await currentPortalAssignments()"))
  assert.equal((portal.match(/\\.rpc\\('upt_my_portal_assignments'\\)/g)||[]).length,0)
  const cache=readFileSync('lib/portal-access-server.ts','utf8')
  assert.ok(cache.includes("currentPortalAssignments=cache(async()"))
  assert.ok(cache.includes("supabase.rpc('upt_my_portal_assignments')"))
  assert.match(portal,/\\: \\{ data: \\[\\] as PortalAssignment\\[\\], error: null \\}/)
})

test('assigned roles retain live membership validation and blocked-account denial',()=>{
  assert.match(portal,/if \(error && !current\.realIsAdmin && !current\.isOwner\)/)
  assert.match(portal,/if \(!current\.realIsAdmin && !current\.isOwner && !canOpenPortal\(portal,/)
  assert.match(portal,/approved: current\.approved,/)
  assert.match(portal,/blocked: current\.account_blocked === true,/)
  assert.match(portal,/if \(\(!current\.approved \|\| current\.account_blocked === true\) && !current\.isOwner\) redirect\('\/portals'\)/)
})

test('promotion chat still queries with an authenticated server client',()=>{
  assert.match(portal,/if \(portal === 'administration'\) return <LazyAdministrationOverviewDashboard/)
  assert.match(portal,/const \{data:promotionChats\}=await \(await createClient\(\)\)\.from\('chat_channels'\)/)
})
