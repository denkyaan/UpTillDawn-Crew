import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
test("migration CI installs only the headless browser and never refreshes system apt repositories",()=>{
 const ci=readFileSync(".github/workflows/fast-change-validation.yml","utf8")
 assert.ok(ci.includes("npx playwright install chromium --only-shell"))
 assert.ok(!ci.includes("npx playwright install --with-deps chromium"))
 assert.ok(!ci.includes("apt-get install"))
 assert.ok(!ci.includes("apt-get update"))
 assert.ok(ci.includes("npm --prefix modern run browser:qa"))
 assert.ok(ci.includes("npm --prefix modern run sessions:qa"))
})
