import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const src=readFileSync(new URL("../lib/administration/contract-signing-archive-dispatch.ts",import.meta.url),"utf8")
test("archive dispatch checks database approval and explicit confirmation",()=>{
 assert.match(src,/if\(!input\.approvalVerified\)/)
 assert.match(src,/if\(!input\.confirmedByOperator\)/)
})
test("archive verification and digest precede any Documenso delivery",()=>{
 const digest=src.indexOf("record.sourceSha256!==sourceHash")
 const verify=src.indexOf("await verifyArchivedContractPdf(")
 const download=src.indexOf("await downloadContractArchive(")
 const dispatch=src.indexOf("return dispatchApprovedSigningEnvelope(")
 assert.ok(digest>=0&&verify>digest&&download>verify&&dispatch>download)
})
test("archive dispatcher exposes no route or direct network send",()=>{
 assert.doesNotMatch(src,/\bfetch\s*\(|distributeContractSigningDraft\s*\(/)
})
