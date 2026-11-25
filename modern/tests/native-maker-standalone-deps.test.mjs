import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=(relative)=>readFileSync(new URL(relative,import.meta.url),"utf8")

test("isolated Maker Studio source path contract matches original Main exactly without importing its root-only module",()=>{
 const original=read("../../lib/god-studio.ts")
 const candidate=read("../src/api/native-maker-studio-reads.ts")
 const fromMain=original.match(/export function editablePath\(path: string\) \{[\s\S]*?\n\}/)?.[0]
 const fromCandidate=candidate.match(/function editablePath\(path: string\) \{[\s\S]*?\n\}/)?.[0]
 assert.ok(fromMain&&fromCandidate)
 assert.equal(fromCandidate,fromMain.replace("export ",""))
 assert.ok(candidate.includes('const MAX_SOURCE_BYTES=500_000'))
 assert.ok(candidate.includes('const STUDIO_REPOSITORY="denkyaan/UpTillDawn-Crew"'))
 assert.ok(!candidate.includes('from "../../../lib/god-studio.ts"'))
 // The modern package has its own exact dependency; no root package install.
 const pkg=JSON.parse(read("../package.json"))
 assert.ok(pkg.dependencies.zod)
})

test("migration PR build runs with the root dependency tree hidden and reliably restored",()=>{
 const ci=read("../../.github/workflows/fast-change-validation.yml")
 const marker="npm --prefix modern install --prefer-offline --no-audit --no-fund"
 const isolate="mv node_modules .upt-root-node-modules-isolation"
 const restore="trap 'mv .upt-root-node-modules-isolation node_modules' EXIT"
 assert.ok(ci.includes(marker))
 assert.ok(ci.includes(isolate))
 assert.ok(ci.includes(restore))
 assert.ok(ci.indexOf(marker)<ci.indexOf(isolate))
 assert.ok(ci.indexOf(isolate)<ci.indexOf("npm --prefix modern run build"))
 assert.match(JSON.parse(read("../package.json")).scripts.build,/tsc --noEmit/)
 assert.ok(ci.includes("npm --prefix modern run build"))
 assert.ok(ci.includes("npm --prefix modern run api:test"))
})
