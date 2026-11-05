import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const main=readFileSync(".github/workflows/deploy-main.yml","utf8")
const production=readFileSync(".github/workflows/deploy-cloudflare.yml","utf8")

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
 assert.match(main.slice(recheck,deploy),/exit 1/)
 assert.match(main.slice(deploy),/wrangler deploy --config wrangler\.main\.jsonc/)
})

test("production remains explicitly dispatched and separate from main",()=>{
 assert.match(production,/name: Deploy production/)
 assert.match(production,/on:\s*\n\s*workflow_dispatch:/)
 assert.doesNotMatch(production,/workflow_run:/)
 assert.doesNotMatch(production,/\n\s*push:/)
 assert.match(production,/environment: production/)
})
