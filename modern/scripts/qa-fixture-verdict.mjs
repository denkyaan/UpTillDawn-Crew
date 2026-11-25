// A green step alone is not evidence: bind both fixture artifacts to the same
// checkout, run and attempt and require the actual per-operation assertions.
import {mkdirSync,writeFileSync,readFileSync} from "node:fs"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"
const draft="app/(app)/portals/administration/modules/[slug]/page.tsx#saveAdministrationEventDraft"
const booking="app/(app)/portals/administration/modules/artists/new/page.tsx#createBooking"
const update="app/(app)/portals/administration/modules/artists/[id]/page.tsx#updateBooking"
const crew=name=>"lib/actions/uptilldawn.ts#"+name
export const expectedOperations=[
 [draft,"positive"],[draft,"positive"],[draft,"denied"],
 [crew("addWorkplace"),"denied"],[crew("addWorkplace"),"positive"],
 [crew("updateWorkplace"),"positive"],[crew("createBriefing"),"positive"],
 [crew("updateBriefing"),"positive"],[booking,"denied"],[booking,"positive"],
 [update,"denied"],[update,"denied"],[update,"positive"]
]
export function fixtureVerdict(env,transactions,cleanup){
 const sha=/^[a-f0-9]{40}$/.test(env.QA_VALIDATED_SHA||"")?env.QA_VALIDATED_SHA:null
 const run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT
 const matches=report=>!!sha&&/^\d+$/.test(run||"")&&/^\d+$/.test(attempt||"")&&
  report?.validatedSha===sha&&report.runId===run&&report.runAttempt===attempt&&
  report.cleaned===true&&report.failed===false&&report.all163ActionsVerified===false&&report.productionReady===false
 const ops=transactions?.operations
 const exact=Array.isArray(ops)&&ops.length===expectedOperations.length&&
  expectedOperations.every(([id,outcome],i)=>ops[i]?.id===id&&ops[i]?.outcome===outcome&&typeof ops[i]?.name==="string"&&!!ops[i].name)
 const positiveFixtureTransactionsVerified=env.QA_FIXTURE_OUTCOME==="success"&&env.QA_FIXTURE_CLEANUP_OUTCOME==="success"&&
  matches(transactions)&&matches(cleanup)&&transactions.cleanupOnly===false&&cleanup.cleanupOnly===true&&
  transactions.positiveActions===8&&transactions.checks?.length===14&&cleanup.positiveActions===0&&
  Array.isArray(cleanup.operations)&&cleanup.operations.length===0&&cleanup.checks?.length===1&&exact
 const verifiedActionIds=positiveFixtureTransactionsVerified?[...new Set(ops.filter(x=>x.outcome==="positive").map(x=>x.id))]:[]
 return {validatedSha:sha,transactions:env.QA_FIXTURE_OUTCOME||"not-run",cleanup:env.QA_FIXTURE_CLEANUP_OUTCOME||"not-run",
  positiveFixtureTransactionsVerified,verifiedActionIds,uniquePositiveActionIds:verifiedActionIds.length,
  remainingUnverifiedOriginalActionIds:163-verifiedActionIds.length,businessWriteParityVerified:false,productionReady:false}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const dir=resolve(import.meta.dirname,"../../test-results/modern-native-fixtures")
 const read=name=>{try{return JSON.parse(readFileSync(resolve(dir,name),"utf8"))}catch{return null}}
 const verdict=fixtureVerdict(process.env,read("transactions.json"),read("cleanup.json"))
 mkdirSync(dir,{recursive:true})
 writeFileSync(resolve(dir,"verdict.json"),JSON.stringify(verdict,null,2)+"\n")
 console.log(JSON.stringify(verdict))
 if(!verdict.positiveFixtureTransactionsVerified)process.exitCode=1
}
