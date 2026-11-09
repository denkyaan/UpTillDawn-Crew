import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {matchesMainDeployClaims,MAIN_OCR_TEST_AUDIENCE,verifyMainDeployOIDC} from "../lib/administration/github-oidc-deploy-test.ts"
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8")

const NOW=1794240000
const good={
 iss:"https://token.actions.githubusercontent.com",
 aud:"uptilldawn-main-ocr-test-v1",
 repository:"denkyaan/UpTillDawn-Crew",
 workflow_ref:"denkyaan/UpTillDawn-Crew/.github/workflows/deploy-main.yml@refs/heads/main",
 ref:"refs/heads/main",event_name:"workflow_run",
 iat:NOW-20,nbf:NOW-20,exp:NOW+100
}

test("only correctly scoped fresh GitHub Deploy main identity is accepted",()=>{
 assert.equal(MAIN_OCR_TEST_AUDIENCE,good.aud)
 assert.equal(matchesMainDeployClaims(good,NOW),true)
 assert.equal(matchesMainDeployClaims({...good,repository:"someone/other-project"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,ref:"refs/heads/production"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,event_name:"pull_request"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,workflow_ref:"denkyaan/UpTillDawn-Crew/.github/workflows/ci.yml@refs/heads/main"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,aud:"another-audience"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,iss:"https://example.com"},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,iat:NOW-900},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,nbf:NOW+180},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,exp:NOW-1},NOW),false)
 assert.equal(matchesMainDeployClaims({...good,exp:NOW+1200},NOW),false)
 assert.equal(matchesMainDeployClaims(null,NOW),false)
})

test("unsigned, altered and malformed OIDC identity tokens fail closed",async()=>{
 assert.equal(await verifyMainDeployOIDC("garbage"),false)
 assert.equal(await verifyMainDeployOIDC("a.b.c"),false)
 assert.equal(await verifyMainDeployOIDC(".".repeat(12001)),false)
 const fakeHead=Buffer.from(JSON.stringify({kid:"not-a-real-key",alg:"none"})).toString("base64url")
 const fakeBody=Buffer.from(JSON.stringify({...good,iat:Math.floor(Date.now()/1000)})).toString("base64url")
 assert.equal(await verifyMainDeployOIDC(fakeHead+"."+fakeBody+".AA"),false)
})

test("main-only diagnostic never exposes provider key or accepts a user document",()=>{
 const route=read("app/api/diagnostics/cloudmersive-ocr/route.ts")
 const flow=read(".github/workflows/deploy-main.yml")
 assert.match(route,/verifyMainDeployOIDC\(bearer\.slice\(7\)\)/)
 assert.match(route,/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.match(route,/CLOUDMERSIVE_OCR_API_KEY/)
 assert.match(route,/api\.cloudmersive\.com\/ocr\/photo\/toText/)
 assert.match(route,/new FormData\(\)/)
 assert.match(route,/SYNTHETIC_PNG/)
 assert.match(route,/UPTILLDAWN/)
 assert.match(route,/matched/)
 assert.doesNotMatch(route,/request\.formData|request\.json|request\.body|supabase|process\.env\.CLOUDFLARE_API_TOKEN/)
 assert.match(flow,/id-token: write/)
 assert.match(flow,/ACTIONS_ID_TOKEN_REQUEST_URL/)
 assert.match(flow,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/)
 assert.match(flow,/Live Cloudmersive OCR test \(synthetic image, signed main deploy\)/)
 assert.match(flow,/uptilldawn-main-ocr-test-v1/)
 assert.match(flow,/api\/diagnostics\/cloudmersive-ocr/)
 assert.match(flow,/status !== "pass"/)
 assert.doesNotMatch(flow,/echo.*ACTIONS_ID_TOKEN_REQUEST_TOKEN|console\.log\(body\.value\)/)
})
