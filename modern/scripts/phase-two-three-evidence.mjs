// Evidence aggregation only: this module never enables writes, deploys, or authorizes a release.
// Failed/absent/foreign-run evidence cannot become a PASS.
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(import.meta.dirname,'../..')
const roles=['head-admin','staff']
const stages=['transport','login-visual','seven-roles','thirty-sessions','deep-routes','all-action-write-denials']
const parse=s=>{try{return JSON.parse(s)}catch{return null}}
const read=p=>{try{return parse(readFileSync(resolve(root,p),'utf8'))}catch{return null}}
export function combinedEvidence(env,ids,live,denials,fixture){
 if(!Array.isArray(ids)||ids.length!==163||new Set(ids).size!==163||ids.some(id=>typeof id!=='string'||!id.includes('#')))throw Error('PHASE23_ACTION_REGISTRY_DRIFT')
 const sha=env.QA_VALIDATED_SHA,run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT
 const bound=e=>/^[a-f0-9]{40}$/.test(sha||'')&&/^\d+$/.test(run||'')&&/^\d+$/.test(attempt||'')&&e?.validatedSha===sha&&e.runId===run&&e.runAttempt===attempt
 const validLive=bound(live)&&live.allReadOnlyStagesPassed===true&&Array.isArray(live.stages)&&live.stages.length===stages.length&&stages.every((stage,i)=>live.stages[i]?.stage===stage&&live.stages[i]?.outcome==='success')
 const keys=new Set(ids.flatMap(id=>roles.map(role=>role+'|'+id)))
 const verified=new Set()
 const validDenials=bound(denials)&&denials.originalActions===163&&denials.signedIdentities===2&&denials.publicWriteDenials===326&&denials.businessWrites===0&&Array.isArray(denials.failures)&&denials.failures.length===0&&Array.isArray(denials.verified)&&denials.verified.length===326&&denials.verified.every(row=>{
  const key=row?.role+'|'+row?.id
  if(!keys.has(key)||verified.has(key))return false
  verified.add(key);return true
 })
 const fixtureIds=fixture?.verifiedActionIds
 const validFixture=bound(fixture)&&fixture.positiveFixtureTransactionsVerified===true&&fixture.transactions==='success'&&fixture.cleanup==='success'&&Array.isArray(fixtureIds)&&fixtureIds.length===fixture.uniquePositiveActionIds&&new Set(fixtureIds).size===fixtureIds.length&&fixtureIds.every(id=>ids.includes(id))
 const positive=new Set(validFixture?fixtureIds:[])
 const actions=ids.map(id=>({id,publicDenialBothRoles:validDenials&&roles.every(role=>verified.has(role+'|'+id)),positiveNativeFixture:positive.has(id),fullOriginalVsNativeBusinessParity:false}))
 const checks={
  readOnlyLiveAcceptance:!!validLive,
  allPublicWriteDenials:!!validDenials,
  nativeFixtureAndCleanup:!!validFixture,
  candidateRuntimePostDeploy:env.QA_CANDIDATE_RUNTIME==='true'&&!!validLive,
  originalRuntimePostDeploy:env.QA_ORIGINAL_RUNTIME==='true'&&!!validLive,
  all163PositiveTransactions:positive.size===ids.length,
  fullOriginalVsNativeBusinessParity:false,
  positiveMakerAuthority:false,
  providerOnboardingAndCallbacks:false,
  offlineReplayRevocationAndDeviceFlows:false,
  allOriginalScreensAndWorkflowStates:false,
  productionSchemaCompatibility:false,
  verifiedRollbackVersion:false,
  explicitProductionReleaseAuthorization:false
 }
 const blockers=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name)
 return {contract:'uptilldawn-phase-two-three-v1',validatedSha:sha||null,runId:run||null,runAttempt:attempt||null,checks,actions,positiveActionCount:positive.size,remainingPositiveActionCount:ids.length-positive.size,blockers,phase2Complete:false,phase3Complete:false,mainCutoverAllowed:false,productionReady:false,productionDeploymentAllowed:false}
}
async function cli(){
 if(process.argv.includes('--export-browser')){
  if(!process.env.GITHUB_OUTPUT)throw Error('PHASE23_GITHUB_OUTPUT_REQUIRED')
  const live=read('test-results/modern-live-qa/verdict.json')
  const denials=read('test-results/modern-action-denials/report.json')
  // Compact, controlled JSON output, no credentials, cookies or user data.
  appendFileSync(process.env.GITHUB_OUTPUT,'live_evidence='+JSON.stringify(live)+'\n'+'denial_evidence='+JSON.stringify(denials)+'\n')
  return
 }
 const {actionEntries}=await import('../tooling/main-source.mjs')
 const report=combinedEvidence(process.env,actionEntries().map(x=>x.id),parse(process.env.QA_BROWSER_EVIDENCE),parse(process.env.QA_DENIAL_EVIDENCE),read('test-results/modern-native-fixtures/verdict.json'))
 const dir=resolve(root,'test-results/modern-phase-two-three')
 mkdirSync(dir,{recursive:true})
 writeFileSync(resolve(dir,'readiness.json'),JSON.stringify(report,null,2)+'\n')
 const summary=['## Phase 2 + 3 combined release readiness','',...Object.entries(report.checks).map(([k,v])=>'- '+k+': '+(v?'PASS':'BLOCKED')),'','Positive action IDs: '+report.positiveActionCount+'/163','Main cutover and production remain blocked.','']
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary.join('\n'))
 console.log(summary.join('\n'))
 // This is a reporting step in existing Main QA, not a bypass of existing failing gates.
 // A deliberate release enforcement invocation must fail until real missing evidence exists.
 if(process.argv.includes('--enforce'))process.exitCode=1
}
if(process.argv[1]===fileURLToPath(import.meta.url))await cli()
