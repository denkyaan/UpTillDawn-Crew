#!/usr/bin/env node
// One machine-readable release contract for all seven original Main migration
// requirements. No hardcoded percent complete; UNKNOWN remains unverified.
// The current isolated candidate cannot be cut over while write actions,
 // provider onboarding, offline replay and every role/route remain untested.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {actionEntries,filesBelow,pages} from '../tooling/main-source.mjs'
import {originalMainRoutes} from '../src/api/main-routes.ts'
import {verifyOriginalActionRegistry} from '../tooling/action-registry-contract.mjs'

const repo=resolve(import.meta.dirname,'../..')
const originalPages=filesBelow('app').filter(x=>/\/page\.tsx?$/.test(x))
const originalApis=filesBelow('app').filter(x=>/\/route\.tsx?$/.test(x))
const originalActions=actionEntries()
const registered=verifyOriginalActionRegistry(originalActions,
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8'))
const env=JSON.parse(readFileSync(resolve(repo,'modern/wrangler.main-qa.jsonc'),'utf8'))
if(env.vars.UPT_MIGRATION_ALLOW_WRITES!=='false'||env.vars.UPT_MIGRATION_SCANNING_ENABLED!=='false'||
 env.vars.UPT_MIGRATION_OAUTH_ENABLED!=='false')
 throw Error('QA write/provider isolation disabled — refusing readiness report')
const originalSourceCount=originalPages.filter(x=>pages.includes(x)).length
const legacyMainServiceBindings=env.services.filter(x=>x.service==='uptilldawn-main')
const legacyBackendDependency=legacyMainServiceBindings.length>0
const workerSource=readFileSync(resolve(repo,'modern/src/api/worker.ts'),'utf8')
const migratedOriginalReads=[
 '/api/push/config',
 '/api/migration/view-data#portal-preference',
 '/api/administration/finance/summary/export',
 '/api/administration/ticketing/event-summary',
 '/api/administration/ticketing/export',
 '/api/administration/payroll/export',
 '/api/administration/provider-mappings',
 '/api/administration/provider-transactions',
]
if(!workerSource.includes('app.get("/api/push/config"')||
   !workerSource.includes('app.post("/api/migration/view-data"')||
   !workerSource.includes('"/api/administration/finance/summary/export"')||
   !workerSource.includes('"/api/administration/ticketing/event-summary"')||
   !workerSource.includes('"/api/administration/ticketing/export"')||
   !workerSource.includes('"/api/administration/payroll/export"')||
   !workerSource.includes('"/api/administration/provider-mappings"')||
   !workerSource.includes('"/api/administration/provider-transactions"')||
   !workerSource.includes('administrationReportResponse(')||
   !workerSource.includes('administrationCsvResponse('))
 throw Error('Native Main source-read route contract changed')
// The candidate's upstream Main service would refer to ITSELF if renamed to
// uptilldawn-main. Cutover must first extract all original server handlers
// into a separate, non-recursive backend or replace them with native Hono
// handlers without changing the RLS/authorization contract.
if(!legacyBackendDependency)throw Error('Backend dependency inventory changed: review cutover topology')
const workstreams=[
 {id:'ui',description:'Pixel, layout, navigation, every original screen and four locales',
  available:{originalPages:originalPages.length,sourceReused:originalSourceCount},
  verified:false,blocker:'Every role/route/mobile/light-dark screen and its visual states require exhaustive live acceptance'},
 {id:'actions',description:'All 163 original event, crew, administrative and financial actions',
  available:{transportMapped:registered.registeredCount},
  verified:false,blocker:'Positive, denied, rollback and audit cases are not yet accepted for every action'},
 {id:'authorization',description:'Role hierarchy, Maker, approval, multi-role, login and recovery',
  available:{signedQAIdentityTypes:7},
  verified:false,blocker:'Complete signup, recovery, role/RLS matrix and signed Maker workflows have not been accepted'},
 {id:'integrations',description:'EventPay, Weeztix, SumUp, Documenso, banking and Peppol',
  available:{originalApiRoutes:originalMainRoutes.length,nativeReadHandlers:migratedOriginalReads.length},
  verified:false,blocker:'Provider onboarding/sandbox callbacks, payment, scanning and real read/write parity remain unverified'},
 {id:'offline',description:'PWA, chat, location/time and offline replay without overload',
  available:{originalSourceRetained:true},
  verified:false,blocker:'Disconnected use, replay, sync conflicts, four locales and Free-tier load validation remain'},
 {id:'e2e',description:'All original pages, API methods, server actions and device journeys',
  available:{originalPages:originalPages.length,originalApis:originalApis.length,originalActions:originalActions.length},
  verified:false,blocker:'44 authenticated read-only routes and 56 role/locale/device checks do not prove complete 101-page/64-API/163-action coverage'},
 {id:'cutover',description:'Atomic existing Main URL switch, rollback and post-switch verification',
  available:{mainQACandidate:'uptilldawn-modern-main',existingMain:'uptilldawn-main'},
  verified:false,blocker:'All six acceptance domains, non-recursive native backend extraction, and isolated rollback rehearsal must pass first'}
]
const report={
 contract:'uptilldawn-main-seven-bundle-v1',
 originalMainPreserved:true,
 productionUntouched:true,
 isolatedCandidateWriteEnabled:false,
 exactActionRegistryMapped:registered.registeredCount===originalActions.length,
 dependsOnLegacyMainBackend:legacyBackendDependency,
 directMainCutoverWouldSelfBind:legacyMainServiceBindings.some(x=>x.binding==='MAIN_AUTH'||x.binding==='MAIN_AUTH_RUNTIME'),
 releaseReady:workstreams.every(x=>x.verified),
 mainCutoverAllowed:false,
 workstreams
}
if(!report.exactActionRegistryMapped||originalApis.length!==originalMainRoutes.length)
 throw Error('Source-to-transport inventory drift; refuse candidate release evidence')
if(process.argv.includes('--enforce-cutover')){
 console.error('ONE_BUNDLE_CUTOVER_BLOCKED '+JSON.stringify(workstreams.filter(x=>!x.verified).map(x=>x.id)))
 process.exitCode=1
}
const outfile=resolve(repo,'test-results/modern-seven-bundle/readiness.json')
mkdirSync(resolve(repo,'test-results/modern-seven-bundle'),{recursive:true})
writeFileSync(outfile,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
