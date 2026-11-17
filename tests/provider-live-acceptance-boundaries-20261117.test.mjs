import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {externalServicesReadiness,externalServicesCopy} from '../lib/administration/external-services-readiness.ts'
import {integrationProviders} from '../lib/administration/integration-credentials.ts'
import {integrationPlacement} from '../lib/administration/integration-placement.ts'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('zero managed credentials must never imply a working vendor integration',()=>{
 const services=externalServicesReadiness({})
 for(const service of services)assert.ok(service.state!=='connected','No code-only connector is live')
 assert.equal(services.find(x=>x.id==='eventpay')?.state,'provider_required')
 assert.equal(services.find(x=>x.id==='peppol')?.state,'provider_required')
 assert.equal(services.find(x=>x.id==='weeztix')?.state,'manual_available')
 assert.deepEqual(services.find(x=>x.id==='eventpay')?.setupVariables,[])
 assert.equal(integrationProviders.includes('eventpay'),false,'Never fabricate an EventPay wallet/API credential')
 const ids=Object.values(integrationPlacement).flat()
 assert.equal(new Set(ids).size,services.length,'Every provider is represented in a workflow')
 assert.deepEqual(integrationPlacement.banking,['banking','sumup','eventpay'])
 assert.deepEqual(integrationPlacement.sales,['sumup','eventpay'])
})

test('read-only probes are same-origin, role-scoped and cannot be payment dispatch',()=>{
 const api=read('app/api/admin/provider-connection-check/route.ts')
 const probe=read('lib/administration/provider-connection-check.ts')
 const config=read('app/api/administration/integrations/route.ts')
 assert.match(api,/requestHasSameOrigin\(request\)/)
 assert.match(api,/integrationManagementAccess\(\)/)
 assert.match(api,/getManagedIntegrationConfig\(access\.db,value/)
 assert.match(api,/bank_accounts_read_only/)
 assert.match(api,/credentials_only/)
 assert.match(api,/value!=="sumup"&&value!=="documenso"&&value!=="banking"&&value!=="peppol"/)
 assert.match(probe,/method:"GET"/)
 assert.match(probe,/method:"POST"/)
 assert.doesNotMatch(probe,/\/checkouts|\/payments\/create|\/wallet\/topup/)
 assert.match(config,/requestHasSameOrigin\(request\)/)
 assert.match(config,/validIntegrationMasterKey/)
 assert.match(config,/integrationManagementAccess\(\)/)
})

test('connection status is honest in NL, FR, EN and DE; provider acceptance remains separately gated',()=>{
 const ui=read('components/admin/provider-connection-probe.tsx')
 const panel=read('components/admin/external-services-readiness.tsx')
 for(const lang of ['nl','fr','en','de']){
  assert.ok(externalServicesCopy[lang].instructions.eventpay.includes('EventPay'))
  assert.ok(externalServicesCopy[lang].title)
  assert.match(ui,new RegExp(' '+lang+':\\{'))
 }
 assert.match(ui,/status==="connected"/)
 assert.match(ui,/bankingConnected/)
 assert.match(ui,/peppolConnected/)
 assert.match(panel,/lookup\.available/)
 assert.match(panel,/statusUnavailable/)
 assert.doesNotMatch(ui,/paymentSucceeded|chargeCaptured|walletBalance/)
 assert.match(read('docs/PRODUCTION_TARGETED_ALIGNMENT_AND_PROVIDER_ACCEPTANCE_20261117.md'),/zero app-managed provider records/)
})
