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

test("production CI has no blanket push trigger",()=>{
 assert.match(productionCi,/workflow_dispatch:/)
 assert.match(productionCi,/workflow_call:/)
 assert.doesNotMatch(productionCi,/\n\s+push:/)
})

test("Main CI is always fast; full isolated validation is exclusive to explicitly dispatched CI production",()=>{
 assert.doesNotMatch(mainCi,/full-validation:/)
 assert.doesNotMatch(mainCi,/browser-acceptance:/)
 assert.doesNotMatch(mainCi,/uses: \.\/\.github\/workflows\/ci\.yml/)
 assert.doesNotMatch(mainCi,/\[full-ci\]|\[qa-main\]|\[release-production\]/)
 assert.match(mainCi,/jobs:\s*\n  fast:/)
 assert.match(mainCi,/name: Parallel lint, typecheck and unit tests/)
 assert.match(mainCi,/npm audit --omit=dev --audit-level=high/)
 assert.match(productionCi,/workflow_dispatch:/)
 assert.match(productionCi,/Run 15 concurrent authenticated browser bots/)
 assert.match(productionCi,/Full event lifecycle release gate/)
 const productionDispatch=productionCi.slice(productionCi.indexOf('  dispatch-production-deploy:'))
 assert.match(productionDispatch,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/)
})

test("production deploy follows successful manually dispatched CI only",()=>{
 assert.match(production,/workflow_dispatch:/)
 assert.doesNotMatch(production,/workflow_run:/)
 assert.match(productionCi,/dispatch-production-deploy:/)
 assert.match(productionCi,/actions\/workflows\/deploy-cloudflare\.yml\/dispatches/)
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
