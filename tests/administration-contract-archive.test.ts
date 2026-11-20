import assert from "node:assert/strict"
import {test} from "node:test"
import {CONTRACT_ARCHIVE_BUCKET,contractArchivePath,isContractArchivePath} from "../lib/administration/contract-archive"
const documentId="123e4567-e89b-42d3-a456-426614174000"
const sha256="a".repeat(64)
test("contract archives are private, versioned, and content-addressed",()=>{
 assert.equal(CONTRACT_ARCHIVE_BUCKET,"administration-contracts")
 for(const kind of ["draft","signed","evidence"] as const){
  const path=contractArchivePath({documentType:"staff",documentId,version:3,kind,sha256})
  assert.ok(isContractArchivePath(path))
  assert.match(path,/^staff\/123e4567.*\/v3\//)
 }
})
test("contract archive paths reject traversal, invalid hashes and versions",()=>{
 assert.throws(()=>contractArchivePath({documentType:"artist",documentId:"../secret",version:1,kind:"signed",sha256}))
 assert.throws(()=>contractArchivePath({documentType:"artist",documentId,version:0,kind:"signed",sha256}))
 assert.throws(()=>contractArchivePath({documentType:"artist",documentId,version:1,kind:"signed",sha256:"not-a-hash"}))
 assert.equal(isContractArchivePath("staff/../../private/file.pdf"),false)
})
