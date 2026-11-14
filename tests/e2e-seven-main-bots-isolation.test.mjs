import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const script='scripts/e2e-seven-main-bots.mjs'
const source=readFileSync(script,'utf8')
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')

test('Main role-browser acceptance is syntactically valid and covers all seven identities',()=>{
 const check=spawnSync(process.execPath,['--check',script],{encoding:'utf8'})
 assert.equal(check.status,0,check.stderr)
 const aliases=['head_admin','left_hand','right_hand','administration','promotion','responsible','staff']
 for(const alias of aliases)assert.ok(source.includes("role:'"+alias+"'"),alias+' missing')
 assert.match(source,/viewports=\[/)
 assert.match(source,/locales=\['nl','fr','en','de'\]/)
 assert.match(source,/page\.waitForURL/)
 assert.match(source,/assertAllowed/)
 assert.match(source,/assertDenied/)
 assert.match(source,/data-login-hydrated/)
 assert.match(source,/scrollWidth/)
})
test('Browser QA is explicitly restricted to exact Main and secret, cannot run against production',()=>{
 assert.match(source,/configUrl!==BASE/)
 assert.match(source,/E2E_MAIN_QA_PASSWORD/)
 assert.match(source,/https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.doesNotMatch(source,/https:\/\/crew\.uptilldawn\.workers\.dev/)
 const denied=spawnSync(process.execPath,[script],{
  encoding:'utf8',env:{...process.env,E2E_MAIN_QA_BASE_URL:'https://crew.uptilldawn.workers.dev',E2E_MAIN_QA_PASSWORD:'x'.repeat(26)}
 })
 assert.notEqual(denied.status,0)
 assert.match(denied.stderr,/restricted to the exact isolated Main URL/)
})
test('Browser QA is manually opted-in, separated from fast Main CI and production deployment',()=>{
 assert.match(workflow,/qa-main-browser-acceptance:/)
 assert.match(workflow,/needs: \[provision-qa-bots, validate-trigger, deploy\]/)
 assert.match(workflow,/inputs\.provision_qa_bots == true/)
 assert.match(workflow,/secrets\.MAIN_QA_BOT_PASSWORD/)
 assert.match(workflow,/node scripts\/e2e-seven-main-bots\.mjs/)
 assert.match(workflow,/actions\/upload-artifact@v4/)
 assert.match(workflow,/if: github\.event_name == 'workflow_run'/)
})

test('denied-route acceptance waits for final RSC authorization and never mistakes loading skeleton for leaked access',()=>{
 assert.match(source,/page\.waitForFunction\(expected=>/)
 assert.match(source,/Authorization result never settled/)
 assert.match(source,/Interrupted navigation returned to its original route/)
 assert.match(source,/status>=500/)
 assert.match(source,/\[401,403,404\]/)
 assert.match(source,/ERR_ABORTED/)
 assert.doesNotMatch(source,/const blocked=\(response\?\.status\(\)\|\|0\)>=400\|\|actual!==path/)
})
test('transient login failures include safe page error diagnostics rather than falsely claiming authentication',()=>{
 assert.match(source,/Login navigation failed for/)
 assert.match(source,/locator\('\[role="alert"\]'\)/)
 assert.match(source,/throw Error\('Login navigation failed/)
})

test('explicit Main-only QA marker runs only after a successful fast CI and successful Main deployment',()=>{
 assert.match(workflow,/qa_eligible: \$\{\{ steps\.check\.outputs\.qa_eligible \}\}/)
 assert.match(workflow,/commit_message=.*gh api/)
 assert.match(workflow,/\[main-qa-e2e\]/)
 assert.match(workflow,/SOURCE_EVENT.*push/)
 assert.match(workflow,/SOURCE_RESULT.*success/)
 assert.match(workflow,/needs\.validate-trigger\.outputs\.qa_eligible == 'true'/)
 assert.match(workflow,/needs\.deploy\.result == 'success'/)
 assert.match(workflow,/always\(\)/)
 assert.doesNotMatch(readFileSync('.github/workflows/fast-change-validation.yml','utf8'),/main-qa-e2e/)
})
