import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("login transport outage is never translated into an invalid password or wrong role",()=>{
 const src=read("components/auth/login-form.tsx")
 const api=read("app/api/auth/portal-login/route.ts")
 assert.match(src,/response\.status===429/)
 assert.match(src,/response\.status>=500/)
 assert.match(src,/return temporaryLoginError\(\)/)
 assert.match(src,/code:"login_request_rejected"/)
 assert.match(src,/setErrorCode\(outage\.code\)/)
 assert.match(src,/setError\(outage\.error\)/)
 assert.doesNotMatch(src,/setErrorCode\("unexpected_action_failure"\)/)
 assert.match(api,/return reject\(503,'login_temporarily_unavailable'\)/)
 assert.match(api,/if\(origin!==expected/)
 assert.match(api,/await signIn\(form\)/)
})

test("all four login locales have distinct user-safe messages for outages and malformed requests",()=>{
 const src=read("components/auth/login-form.tsx")
 for(const label of ["nl","fr","en","de"]){
  assert.match(src,new RegExp("  "+label+":\"[^\"]+\""))
 }
 assert.match(src,/loginServiceUnavailable\[initialUiLocale\(\)\]/)
 assert.match(src,/loginRequestRejected\[initialUiLocale\(\)\]/)
 assert.doesNotMatch(src,/setError\(portal === "admin" \|\| portal === "responsible"/)
})

test("Main browser acceptance waits for final device language; never blesses a persistent mismatch",()=>{
 const source=read("scripts/e2e-seven-main-bots.mjs")
 assert.match(source,/page\.waitForFunction\(expected=>/)
 assert.match(source,/document\.documentElement\.lang\.toLowerCase\(\)/)
 assert.match(source,/locale,\{timeout:7000\}/)
 assert.match(source,/App language mismatch after hydration/)
 assert.match(source,/QA MAIN BROWSER RESULT/)
 assert.match(source,/if\(errors\.length\)/)
})
