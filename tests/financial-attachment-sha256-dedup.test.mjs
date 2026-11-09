import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {financialAttachmentPayload} from '../lib/administration/financial-attachment-integrity.ts'

const hash=bytes=>createHash('sha256').update(bytes).digest('hex')

test('financial attachment fingerprint hashes full binary bytes, not names or MIME',async()=>{
 const sample=Buffer.from('%PDF-1.7\nThis is a deliberately synthetic invoice.\n%%EOF\n')
 const file=new Blob([sample],{type:'application/pdf'})
 const result=await financialAttachmentPayload(file)
 assert.equal(result.sha256,hash(sample))
 assert.deepEqual(Buffer.from(result.bytes),sample)
 assert.equal(result.bytes.byteLength,file.size)
})

test('binary changes anywhere in a financial attachment change its fingerprint',async()=>{
 const a=Buffer.alloc(50000,0)
 const b=Buffer.from(a)
 b[b.length-1]=1
 const one=await financialAttachmentPayload(new Blob([a]))
 const two=await financialAttachmentPayload(new Blob([b]))
 assert.notEqual(one.sha256,two.sha256,'Full file content must be hashed')
})

test('empty and over-limit financial attachment payloads cannot be hashed and uploaded',async()=>{
 await assert.rejects(financialAttachmentPayload(new Blob([])),/Invalid financial attachment size/)
 await assert.rejects(financialAttachmentPayload(new Blob([new Uint8Array(20*1024*1024+1)])),/Invalid financial attachment size/)
})

test('finance upload stores the exact hashed bytes and applies a preflight and database race guard',()=>{
 const source=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
 const action=source.slice(source.indexOf('async function uploadFinancialAttachment('),source.indexOf('export const dynamic'))
 assert.match(action,/validateUploadSecurity\(file\)/)
 assert.match(action,/financialAttachmentPayload\(file\)/)
 assert.match(action,/payload\.bytes\.byteLength!==validation\.size/)
 assert.match(action,/\.eq\('document_id',documentId\)\.eq\('sha256',payload\.sha256\)/)
 assert.match(action,/\.upload\(path,payload\.bytes,\{contentType:validation\.mime,upsert:false\}\)/)
 assert.match(action,/sha256:payload\.sha256/)
 assert.match(action,/\.remove\(\[path\]\)/)
 assert.match(action,/linkError\.code==='23505'/)
 for(const locale of ['nl','fr','en','de']){
  assert.match(source,new RegExp(locale+':\\{upload:'))
 }
 assert.match(source,/params\.duplicate==='1'/)
 assert.match(source,/a\.sha256\.slice\(0,12\)/)
})

test('DB migration adds a conditional per-invoice uniqueness guard without rewriting legacy hashes',()=>{
 const sql=readFileSync('supabase/migrations/20261109090000_financial_attachment_sha256_dedup.sql','utf8')
 assert.match(sql,/add column if not exists sha256 text/i)
 assert.match(sql,/sha256 is null or sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i)
 assert.match(sql,/create unique index if not exists admin_financial_attachments_document_sha256_unique/i)
 assert.match(sql,/\(document_id,sha256\)/)
 assert.match(sql,/where sha256 is not null/i)
 assert.doesNotMatch(sql,/update\s+public\.admin_financial_attachments/i)
})
