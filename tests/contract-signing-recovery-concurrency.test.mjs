import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-recovery.ts",import.meta.url),"utf8")
test("signed contract recovery reloads ledger before remote download",()=>{
 assert.match(source,/const latest=await ledger\.load/)
 assert.match(source,/latest\.envelopeId!==record\.envelopeId/)
 assert.match(source,/latest\.sourceSha256!==record\.sourceSha256/)
 assert.match(source,/latest\.signedPdfPath/)
})
test("archive recovery rechecks concurrency and refuses conflicting evidence",()=>{
 assert.match(source,/const current=await ledger\.load/)
 assert.match(source,/current\.signedPdfPath===archive\.path/)
 assert.match(source,/Conflicting signed PDF archive already recorded/)
})

test("already archived signed contracts must still have PDF header and bounded size",()=>{
 assert.match(source,/bytes\.length<5\|\|bytes\.length>15\*1024\*1024/)
 assert.match(source,/String\.fromCharCode\(\.\.\.bytes\.slice\(0,5\)\)!=="%PDF-"/)
})
