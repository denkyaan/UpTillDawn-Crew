import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('administration integration authorization preserves the Supabase RPC receiver',()=>{
 const access=read('lib/administration/integration-management-access.ts')
 assert.match(access,/const invoke=access\.db\.rpc\.bind\(access\.db\) as unknown as/)
 assert.doesNotMatch(access,/const invoke=access\.db\.rpc\s+as unknown as/)
})

test('all integration-store RPC calls preserve the client receiver',()=>{
 const store=read('lib/administration/integration-store.ts')
 assert.equal((store.match(/const invoke=db\.rpc\.bind\(db\) as unknown as/g)??[]).length,6)
 assert.doesNotMatch(store,/const invoke=db\.rpc\s+as unknown as/)
})

test('administration billing stays in settings while integrations live in their actual modules',()=>{
 const settings=read('app/(app)/portals/administration/modules/settings/page.tsx')
 const moduleSource=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 assert.match(settings,/BillingProfile\(/)
 assert.doesNotMatch(moduleSource,/slug==="settings"&&<ExternalServicesReadiness/)
 assert.match(moduleSource,/integrationServicesForWorkspace\(slug,externalServicesReadiness\(process\.env\)\)/)
})
