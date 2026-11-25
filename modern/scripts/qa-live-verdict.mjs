// A failed, cancelled, skipped or missing stage is NEVER passing evidence.
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const stages=Object.freeze([
 ['transport','QA_TRANSPORT_OUTCOME'],['login-visual','QA_LOGIN_OUTCOME'],
 ['seven-roles','QA_ROLES_OUTCOME'],['thirty-sessions','QA_SESSIONS_OUTCOME'],
 ['deep-routes','QA_DEEP_OUTCOME']
])
const accepted=new Set(['success','failure','cancelled','skipped'])
export function liveVerdict(env){
 const sha=typeof env.QA_VALIDATED_SHA==='string'&&/^[0-9a-f]{40}$/.test(env.QA_VALIDATED_SHA)?env.QA_VALIDATED_SHA:null
 const results=stages.map(([name,key])=>({stage:name,
  outcome:accepted.has(env[key])?env[key]:'not-run'}))
 const allReadOnlyStagesPassed=sha!==null&&results.every(stage=>stage.outcome==='success')
 return {contract:'uptilldawn-live-main-qa-v1',validatedSha:sha,stages:results,
  allReadOnlyStagesPassed,businessWriteParityVerified:false,providerParityVerified:false,
  offlineReplayVerified:false,makerPositiveFlowVerified:false,mainCutoverAllowed:false,productionReady:false}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=liveVerdict(process.env)
 const dir=resolve(import.meta.dirname,'../../test-results/modern-live-qa')
 mkdirSync(dir,{recursive:true})
 writeFileSync(resolve(dir,'verdict.json'),JSON.stringify(result,null,2)+'\n')
 if(process.env.GITHUB_STEP_SUMMARY){
  const lines=['## Live Main-QA per-stage verdict','',
   'Validated commit: '+(result.validatedSha||'unverified'),'',
   '| Stage | Outcome |','| --- | --- |',
   ...result.stages.map(x=>'| '+x.stage+' | '+x.outcome+' |'),
   '',result.allReadOnlyStagesPassed?'All five selected read-only stages passed.':'At least one required stage failed or did not run.',
   'Business writes, provider onboarding, offline replay and positive Maker access remain unverified. Main cutover and production release remain blocked.','']
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n'))
 }
 console.log(JSON.stringify(result))
 if(!result.allReadOnlyStagesPassed)process.exitCode=1
}
