import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
test("fast CI installs only headless Chromium; authenticated QA remains a separate opt-in job",()=>{
 const workflow=readFileSync(".github/workflows/fast-change-validation.yml","utf8")
 const ci=workflow.split("  fast:")[1].split("  phase-two-three-local-acceptance:")[0]
 assert.ok(ci,"ordinary fast job is present")
 const deploy=readFileSync(".github/workflows/deploy-main.yml","utf8")
 const modernQa=deploy.split("  qa-modern-main-qa:")[1]?.split("  qa-native-admin-http:")[0]
 assert.ok(modernQa,"isolated modern QA job must exist")
 assert.ok(ci.includes("npx playwright install chromium --only-shell"))
 assert.ok(!ci.includes("npx playwright install --with-deps chromium"))
 assert.ok(!ci.includes("apt-get install"))
 assert.ok(!ci.includes("apt-get update"))
 assert.ok(!ci.includes("npm --prefix modern run browser:qa"))
 assert.ok(!ci.includes("npm --prefix modern run sessions:qa"))
 assert.ok(modernQa.includes("playwright install chromium --only-shell"))
 assert.ok(!modernQa.includes("--with-deps chromium"))
 assert.ok(!modernQa.includes("apt-get install"))
 assert.ok(!modernQa.includes("apt-get update"))
 assert.ok(modernQa.includes("npm --prefix modern run browser:qa"))
 assert.ok(modernQa.includes("npm --prefix modern run sessions:qa"))
})
