import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/documenso-envelope.ts",import.meta.url),"utf8")
const readiness=readFileSync(new URL("../lib/administration/contract-service-readiness.ts",import.meta.url),"utf8")
test("remote status response must prove the queried envelope identity",()=>{
 assert.match(source,/data\.id!==id/)
 assert.match(source,/Invalid Documenso status/)
})
test("external service readiness cannot activate contract dispatch",()=>{
 assert.match(readiness,/ready:false/)
 assert.match(readiness,/signingDispatchEnabled\(\)/)
 assert.match(readiness,/pdf_renderer_configured/)
 assert.doesNotMatch(readiness,/apiKey:|pdfToken:/)
})
