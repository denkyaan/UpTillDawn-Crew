// Keep privileged fixture results separate from the read-only browser job.
import {mkdirSync,writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"
export function fixtureVerdict(env){
 const sha=/^[a-f0-9]{40}$/.test(env.QA_VALIDATED_SHA||"")?env.QA_VALIDATED_SHA:null
 const positiveFixtureTransactionsVerified=!!sha&&env.QA_FIXTURE_OUTCOME==="success"&&env.QA_FIXTURE_CLEANUP_OUTCOME==="success"
 return {validatedSha:sha,transactions:env.QA_FIXTURE_OUTCOME||"not-run",cleanup:env.QA_FIXTURE_CLEANUP_OUTCOME||"not-run",positiveFixtureTransactionsVerified,businessWriteParityVerified:false,productionReady:false}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const verdict=fixtureVerdict(process.env)
 const dir=resolve(import.meta.dirname,"../../test-results/modern-native-fixtures")
 mkdirSync(dir,{recursive:true})
 writeFileSync(resolve(dir,"verdict.json"),JSON.stringify(verdict,null,2)+"\n")
 console.log(JSON.stringify(verdict))
 if(!verdict.positiveFixtureTransactionsVerified)process.exitCode=1
}
