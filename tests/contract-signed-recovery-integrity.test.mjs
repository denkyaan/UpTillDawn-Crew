import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-recovery.ts",import.meta.url),"utf8")
test("existing signed PDF path requires approval, remote completion and archive integrity",()=>{
 assert.match(source,/if\(!input\.approvedVersionVerified\)throw/)
 assert.match(source,/getContractSigningStatus\(record\.envelopeId\)/)
 assert.match(source,/remote\.id!==record\.envelopeId\|\|remote\.status!=="COMPLETED"/)
 assert.match(source,/downloadContractArchive\(record\.signedPdfPath,client\)/)
 assert.match(source,/contractArchivePath\(/)
 assert.match(source,/Signed PDF archive identity mismatch/)
})
