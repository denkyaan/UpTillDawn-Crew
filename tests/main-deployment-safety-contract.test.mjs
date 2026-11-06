import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const main=readFileSync(".github/workflows/deploy-main.yml","utf8")
const mainCi=readFileSync(".github/workflows/fast-change-validation.yml","utf8")
const production=readFileSync(".github/workflows/deploy-cloudflare.yml","utf8")
const productionCi=readFileSync(".github/workflows/ci.yml","utf8")

test("main deployment runs only after CI main and cancels superseded runs",()=>{
 assert.match(main,/workflow_run:\s*\n\s*workflows: \["CI main"\]/)
 assert.match(main,/branches: \[main\]/)
 assert.match(main,/group: uptilldawn-main-app\s*\n\s*cancel-in-progress: true/)
 assert.match(main,/SOURCE_RESULT.*success/)
 assert.match(main,/SOURCE_SHA.*current_sha/)
 assert.match(main,/needs: validate-trigger/)
 assert.match(main,/if: needs\.validate-trigger\.outputs\.eligible == 'true'/)
})

test("main deployment checks the tested SHA again immediately before deploy",()=>{
 const recheck=main.indexOf("name: Revalidate current main commit before deployment")
 const deploy=main.indexOf("name: Deploy main test Worker only")
 assert.ok(recheck>0&&deploy>recheck)
 assert.match(main.slice(recheck,deploy),/current_sha.*VALIDATED_SHA/)
 assert.match(main.slice(recheck,deploy),/current=false/)
 assert.match(main.slice(recheck,deploy),/current=true/)
 assert.match(main.slice(deploy),/if: steps\.current-main\.outputs\.current == 'true'/)
 for(const step of ["Diagnose Cloudflare workers.dev routing","Smoke test main app"]){
  const offset=main.indexOf("name: "+step)
  assert.ok(offset>0)
  assert.match(main.slice(offset,offset+200),/if: steps\.current-main\.outputs\.current == 'true'/)
 }
 assert.match(main.slice(deploy),/wrangler deploy --config wrangler\.main\.jsonc/)
})

test("production CI is not started by main pushes",()=>{
 assert.match(productionCi,/workflow_dispatch:/)
 assert.match(productionCi,/workflow_call:/)
 assert.doesNotMatch(productionCi,/\n\s+push:/)
})

test("production deploy follows successful manually dispatched CI only",()=>{
 assert.match(production,/workflow_dispatch:/)
 assert.match(production,/workflow_run:/)
 assert.match(production,/workflow_run\.conclusion == 'success'/)
 assert.match(production,/workflow_run\.event == 'workflow_dispatch'/)
 assert.match(production,/workflow_run\.head_branch == 'main'/)
 assert.match(production,/environment: production/)
 assert.match(production,/head_sha=\$\{RELEASE_SHA\}/)
 assert.match(production,/ref: \$\{\{ env\.RELEASE_SHA \}\}/)
 assert.match(production,/test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/)
 assert.doesNotMatch(production,/Main moved since validation; refusing stale production release/)
 assert.doesNotMatch(production,/Revalidate release SHA immediately before production deployment/)
})

test("main CI requires explicit release input before dispatching production CI",()=>{
 assert.match(mainCi,/release_production:/)
 assert.match(mainCi,/default: false/)
 assert.match(mainCi,/needs: fast/)
 assert.match(mainCi,/github.event_name == 'workflow_dispatch'/)
 assert.match(mainCi,/inputs.release_production == true/)
 assert.match(mainCi,/actions\/workflows\/ci\.yml\/dispatches/)
 assert.match(mainCi,/current_sha.*GITHUB_SHA/)
 assert.doesNotMatch(mainCi,/Main changed; refusing stale release/)
 assert.match(mainCi,/dispatches" -f ref=main/)
})
