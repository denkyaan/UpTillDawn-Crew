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
import {nativeAdminActionIds} from '../src/api/native-admin-actions.ts'
import {nativeWaveTwoActionIds} from '../src/api/native-platform-actions.ts'
import {nativeWaveThreeActionIds} from '../src/api/native-event-shift-actions.ts'
import {nativeInventoryActionIds} from '../src/api/native-inventory-checklist-actions.ts'
import {nativeRosterActionIds} from '../src/api/native-roster-handover-actions.ts'
import {nativeCatalogActionIds} from '../src/api/native-catalog-event-actions.ts'
import {megaPeopleActionIds} from '../src/api/native-mega-people-actions.ts'
import {megaOperationsActionIds} from '../src/api/native-mega-operations-actions.ts'
import {megaCrewEventActionIds} from '../src/api/native-mega-crew-event-actions.ts'
import {megaMakerActionIds} from '../src/api/native-mega-maker-actions.ts'
import {nativeWaveNineActionIds} from '../src/api/native-wave-nine-safe-actions.ts'
import {finalCrewActionIds} from '../src/api/native-final-crew-actions.ts'
import {finalOperationsActionIds} from '../src/api/native-final-operations-actions.ts'
import {finalAdminDetailsActionIds} from '../src/api/native-final-admin-details.ts'
import {finalFinanceActionIds} from '../src/api/native-final-finance-actions.ts'
import {finalAgreementsActionIds} from '../src/api/native-final-agreements-actions.ts'

const repo=resolve(import.meta.dirname,'../..')
const originalPages=filesBelow('app').filter(x=>/\/page\.tsx?$/.test(x))
const originalApis=filesBelow('app').filter(x=>/\/route\.tsx?$/.test(x))
const originalActions=actionEntries()
const registered=verifyOriginalActionRegistry(originalActions,
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8'))
const env=JSON.parse(readFileSync(resolve(repo,'modern/wrangler.main-qa.jsonc'),'utf8'))
if(env.vars.UPT_MIGRATION_ALLOW_WRITES!=='false'||env.vars.UPT_MIGRATION_SCANNING_ENABLED!=='false'||
 env.vars.UPT_MIGRATION_OAUTH_ENABLED!=='false'||
 env.vars.UPT_MIGRATION_NATIVE_AUTH_ENABLED!=='false')
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
 '/api/migration/view-data#god-session-rpc',
 '/api/god/automation-rules',
 '/api/god/preview-role',
 '/api/god/rules',
 '/api/god/data',
 '/api/god/error-reports',
 '/api/error-reports',
 '/api/administration/finance/export',
 '/api/facebook-event',
 '/portals/switch/:portal',
]
if(!workerSource.includes('app.get("/api/push/config"')||
   !workerSource.includes('app.post("/api/migration/view-data"')||
   !workerSource.includes('"/api/administration/finance/summary/export"')||
   !workerSource.includes('"/api/administration/ticketing/event-summary"')||
   !workerSource.includes('"/api/administration/ticketing/export"')||
   !workerSource.includes('"/api/administration/payroll/export"')||
   !workerSource.includes('"/api/administration/provider-mappings"')||
   !workerSource.includes('"/api/administration/provider-transactions"')||
   !workerSource.includes('"/api/god/automation-rules"')||
   !workerSource.includes('"/api/god/preview-role"')||
   !workerSource.includes('"/api/god/rules"')||
   !workerSource.includes('"/api/god/data"')||
   !workerSource.includes('"/api/god/error-reports"')||
   !workerSource.includes('"/api/error-reports"')||
   !workerSource.includes('godSourceReadResponse(')||
   !workerSource.includes('administrationReportResponse(')||
   !workerSource.includes('administrationCsvResponse(')||
   !workerSource.includes('nativeFinanceExportResponse(')||
   !workerSource.includes('nativeFacebookEventResponse(')||
   !workerSource.includes('nativeGeoapifyAutocompleteResponse(')||
   !workerSource.includes('nativePortalSwitchResponse(')||
   !workerSource.includes('return c.json({error:"unknown_action"},404)'))
 throw Error('Native Main source-read route contract changed')
// Internal one-hop rejection stops runaway accidental recursion, but DOES NOT
// make the original Main service independently available at cutover: every
// remaining server action still requires an actual separate backend.
if(!workerSource.includes('main_backend_recursion_blocked')||
   !readFileSync(resolve(repo,'modern/src/api/main-source.ts'),'utf8').includes('X-UpTillDawn-Main-Bridge'))
 throw Error('Main backend recursion guard missing')
// The candidate's upstream Main service would refer to ITSELF if renamed to
// uptilldawn-main. Cutover must first extract all original server handlers
// into a separate, non-recursive backend or replace them with native Hono
// handlers without changing the RLS/authorization contract.
if(!legacyBackendDependency)throw Error('Backend dependency inventory changed: review cutover topology')
if(nativeAdminActionIds.length!==12||!nativeAdminActionIds.every(id=>registered.registeredCount>0&&
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Native admin action registry drift: original source and action IDs must match')
if(nativeWaveTwoActionIds.length!==11||!nativeWaveTwoActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Wave-two original action IDs drifted: refuse unreviewed handlers')
if(nativeWaveThreeActionIds.length!==12||!nativeWaveThreeActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Third-wave original action IDs drifted: refuse unreviewed handlers')
if(nativeInventoryActionIds.length!==14||!nativeInventoryActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Fourth-wave original action IDs drifted: refuse unreviewed handlers')
if(nativeRosterActionIds.length!==7||!nativeRosterActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Fifth-wave source action ID drift: reject unreviewed handlers')
if(nativeCatalogActionIds.length!==10||!nativeCatalogActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Sixth-wave original catalog and event action IDs drifted')
if(megaPeopleActionIds.length!==11||megaOperationsActionIds.length!==10||
 ![...megaPeopleActionIds,...megaOperationsActionIds].every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Seventh-wave original action IDs drifted or one workflow disappeared')
if(megaCrewEventActionIds.length!==11||megaMakerActionIds.length!==4||
 ![...megaCrewEventActionIds,...megaMakerActionIds].every(id=>
  readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Eighth-wave crew and Maker source action IDs drifted')
if(nativeWaveNineActionIds.length!==4||!nativeWaveNineActionIds.every(id=>
 readFileSync(resolve(repo,'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Ninth-wave document/checklist/personnel registry drift')
const remainingFinalActionIds=[
 ...finalCrewActionIds,...finalOperationsActionIds,...finalAdminDetailsActionIds,
 ...finalFinanceActionIds,...finalAgreementsActionIds
]
if(remainingFinalActionIds.length!==57||
 !remainingFinalActionIds.every(id=>readFileSync(resolve(repo,
  'lib/migration/original-action-registry.ts'),'utf8').includes('"'+id+'"')))
 throw Error('Final 57 original action IDs missing or drifted')
const allNativeActions=[
 ...nativeAdminActionIds,...nativeWaveTwoActionIds,...nativeWaveThreeActionIds,
 ...nativeInventoryActionIds,...nativeRosterActionIds,...nativeCatalogActionIds,
 ...megaPeopleActionIds,...megaOperationsActionIds,...megaCrewEventActionIds,
 ...megaMakerActionIds,...nativeWaveNineActionIds,...remainingFinalActionIds
]
if(allNativeActions.length!==163||new Set(allNativeActions).size!==163||
  !originalActions.every(entry=>allNativeActions.includes(entry.id)))
 throw Error('All 163 source actions must appear exactly once in the final mega-bundle')
if(!workerSource.includes('nativeWaveTwoAllowed(hint)')||
 !workerSource.includes('nativeWaveTwoActionResponse(')||
 !workerSource.includes('nativeWaveThreeAllowed(hint)')||
 !workerSource.includes('nativeWaveThreeActionResponse(')||
 !workerSource.includes('nativeInventoryActionAllowed(hint)')||
 !workerSource.includes('nativeInventoryActionResponse(')||
 !workerSource.includes('nativeRosterActionAllowed(hint)')||
 !workerSource.includes('nativeRosterActionResponse(')||
 !workerSource.includes('nativeCatalogActionAllowed(hint)')||
 !workerSource.includes('nativeCatalogActionResponse(')||
 !workerSource.includes('megaPeopleAllowed(hint)')||
 !workerSource.includes('megaPeopleResponse(')||
 !workerSource.includes('megaOperationsAllowed(hint)')||
 !workerSource.includes('megaOperationsResponse(')||
 !workerSource.includes('megaCrewEventAllowed(hint)')||
 !workerSource.includes('megaCrewEventResponse(')||
 !workerSource.includes('megaMakerAllowed(hint)')||
 !workerSource.includes('megaMakerResponse(')||
 !workerSource.includes('nativeWaveNineAllowed(hint)')||
 !workerSource.includes('nativeWaveNineResponse(')||
 !workerSource.includes('finalCrewActionAllowed(hint)')||
 !workerSource.includes('finalCrewActionResponse(')||
 !workerSource.includes('finalOperationsActionAllowed(hint)')||
 !workerSource.includes('finalOperationsActionResponse(')||
 !workerSource.includes('finalAdminDetailsAllowed(hint)')||
 !workerSource.includes('finalAdminDetailsResponse(')||
 !workerSource.includes('finalFinanceActionAllowed(hint)')||
 !workerSource.includes('finalFinanceResponse(')||
 !workerSource.includes('finalAgreementsAllowed(hint)')||
 !workerSource.includes('finalAgreementsResponse(')||
 !workerSource.includes('originalGodLogout(c.req.raw,null)'))
 throw Error('Native wave-two Hono dispatcher missing')
if(env.vars.UPT_MIGRATION_ALLOW_WRITES!=='false')throw Error('Native action wave cannot enable QA writes')
const workstreams=[
 {id:'ui',description:'Pixel, layout, navigation, every original screen and four locales',
  available:{originalPages:originalPages.length,sourceReused:originalSourceCount},
  verified:false,blocker:'Every role/route/mobile/light-dark screen and its visual states require exhaustive live acceptance'},
 {id:'actions',description:'All 163 original event, crew, administrative and financial actions',
  available:{transportMapped:registered.registeredCount,
   nativeExtractedButDisabled:allNativeActions.length,nativeAuthorizedWritePaths:0},
  verified:false,blocker:'Every source ID is now native-gated, but positive, denied, rollback and audit cases are not yet accepted against a real QA database for all 163 actions'},
 {id:'authorization',description:'Role hierarchy, Maker, approval, multi-role, login and recovery',
  available:{signedQAIdentityTypes:7,nativeDirectAuthAvailable:true,nativeDirectAuthEnabled:false},
  verified:false,blocker:'Complete signup, recovery, role/RLS matrix and signed Maker workflows have not been accepted'},
 {id:'integrations',description:'EventPay, Weeztix, SumUp, Documenso, banking and Peppol',
  available:{originalApiRoutes:originalMainRoutes.length,
   nativeReadHandlers:migratedOriginalReads.length,
   nativeGeoapifyKeyDeclared:typeof env.vars.GEOAPIFY_API_KEY==='string'&&Boolean(env.vars.GEOAPIFY_API_KEY)},
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
 nativeAuthAvailableButDisabled:true,
 originalActionFallbackRemoved:workerSource.includes('return c.json({error:"unknown_action"},404)'),
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
