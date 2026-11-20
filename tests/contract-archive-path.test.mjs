import test from "node:test"
import assert from "node:assert/strict"
import {contractArchivePath,isContractArchivePath} from "../lib/administration/contract-archive.ts"

const documentId="12345678-1234-4234-8234-123456789abc"
const sha256="a".repeat(64)

test("archive paths are content-addressed and valid",()=>{
 for(const kind of ["draft","signed","evidence"]){
  const path=contractArchivePath({documentType:"artist",documentId,version:1,kind,sha256})
  assert.equal(isContractArchivePath(path),true)
  assert.ok(path.endsWith(kind+"-"+sha256+(kind==="evidence"?".json":".pdf")))
 }
})
test("archive paths reject traversal, invalid digests and unsafe versions",()=>{
 const valid=contractArchivePath({documentType:"staff",documentId,version:2,kind:"draft",sha256})
 for(const path of ["../"+valid,valid.replace("/v2/","/v9007199254740992/"),valid.replace("/v2/","/v0/"),valid.replace(sha256,"x".repeat(64)),valid.replace("staff/","other/")]){
  assert.equal(isContractArchivePath(path),false,path)
 }
 assert.throws(()=>contractArchivePath({documentType:"staff",documentId,version:Number.MAX_SAFE_INTEGER+1,kind:"draft",sha256}))
 assert.throws(()=>contractArchivePath({documentType:"staff",documentId:"../escape",version:1,kind:"draft",sha256}))
})
