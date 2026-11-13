import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const manager=readFileSync('components/admin/integration-credential-manager.tsx','utf8')
const probe=readFileSync('components/admin/provider-connection-probe.tsx','utf8')
const route=readFileSync('app/api/admin/provider-connection-check/route.ts','utf8')
const server=readFileSync('lib/administration/provider-connection-check.ts','utf8')

test('saving provider credentials triggers exactly the existing credential-only check',()=>{
 assert.match(manager,/if\(provider==="sumup"\|\|provider==="documenso"\|\|provider==="banking"\|\|provider==="peppol"\)/)
 assert.match(manager,/response\.ok/)
 assert.match(manager,/uptilldawn-integration-credentials-changed/)
 assert.match(manager,/action:method==="POST"\?"saved":"removed"/)
 assert.match(probe,/event\.detail\.provider!==provider/)
 assert.match(probe,/event\.detail\.action==="saved"\)void check\(true\)/)
 assert.match(probe,/event\.detail\.action==="removed"\)\{/)
 assert.match(probe,/window\.removeEventListener\("uptilldawn-integration-credentials-changed"/)
})
test('automatic checks are guarded against overlap, still rate limit manual tests and do not expose credentials',()=>{
 assert.match(probe,/inFlight\.current/)
 assert.match(probe,/!force&&Date\.now\(\)-last\.current<12000/)
 assert.match(probe,/inFlight\.current=false/)
 assert.match(probe,/currentRequest\.current\?\.abort\(\)/)
 assert.match(probe,/currentRequest\.current===controller/)
 assert.match(probe,/signal:controller\.signal/)
 assert.match(probe,/\/api\/admin\/provider-connection-check/)
 assert.match(route,/integrationManagementAccess\(\)/)
 assert.match(route,/getManagedIntegrationConfig\(access\.db,value as ConnectionProvider\)/)
 assert.match(route,/requestHasSameOrigin\(request\)/)
 assert.match(route,/scope:value==="banking"\?"bank_accounts_read_only":"credentials_only"/)
 assert.match(server,/method:"GET"/)
 assert.match(server,/grant_type=client_credentials/)
 assert.doesNotMatch(probe,/\/api\/payments|\/api\/transactions|secret|apiKey|ciphertext/i)
})
