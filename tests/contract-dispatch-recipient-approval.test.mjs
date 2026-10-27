import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-dispatch-readiness.ts",import.meta.url),"utf8")
test("dispatch requires an approval timestamp not in the future",()=>{
 assert.match(source,/approvalTime>Date\.now\(\)/)
})
test("dispatch requires a syntactically valid recipient matching the approved document",()=>{
 assert.match(source,/recipient!==approvedRecipient/)
 assert.match(source,/test\(recipient\)/)
})

test("recipient pattern accepts normal email and rejects spaces and missing domain dot",()=>{
 const line=source.split("\n").find(line=>line.includes(".test(recipient)"))
 assert.ok(line,"recipient validation regex missing")
 const literal=line.trim().match(/^if\(!(.+)\.test\(recipient\)\|\|$/)?.[1]
 assert.ok(literal,"recipient validation expression changed")
 const pattern=new Function("return "+literal)()
 assert.equal(pattern.test("artist@example.com"),true)
 assert.equal(pattern.test("artist@examplecom"),false)
 assert.equal(pattern.test("artist name@example.com"),false)
 assert.equal(pattern.test("artist@example\\com"),false)
})

test("dispatch rejects signing records with an existing signed archive",()=>{
 assert.match(source,/record\?\.signedPdfPath!==null/)
})
