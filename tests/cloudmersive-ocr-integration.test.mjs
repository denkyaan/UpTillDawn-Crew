import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeCloudmersiveOcr,verifiedOcrFileType} from '../lib/administration/cloudmersive-ocr.ts'
import {pendingPdfJobId,signOcrJob,verifyOcrJob} from '../lib/administration/cloudmersive-ocr-job.ts'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Cloudmersive OCR validates actual file signatures and matching extensions/types',()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0])
 const jpeg=Uint8Array.from([255,216,255,0,0,0,0,0])
 const pdf=new TextEncoder().encode('%PDF-1.7')
 assert.equal(verifiedOcrFileType(png,'image/png','receipt.png'),'image/png')
 assert.equal(verifiedOcrFileType(jpeg,'image/jpeg','receipt.jpg'),'image/jpeg')
 assert.equal(verifiedOcrFileType(jpeg,'image/jpeg','receipt.jpeg'),'image/jpeg')
 assert.equal(verifiedOcrFileType(pdf,'application/pdf','supplier.pdf'),'application/pdf')
 assert.equal(verifiedOcrFileType(pdf,'image/png','supplier.png'),null)
 assert.equal(verifiedOcrFileType(png,'application/pdf','supplier.pdf'),null)
 assert.equal(verifiedOcrFileType(jpeg,'image/jpeg','supplier.exe'),null)
 assert.equal(verifiedOcrFileType(new TextEncoder().encode('<script>'),'image/png','receipt.png'),null)
})

test('OCR response parsing bounds untrusted output, rejects empty and malformed and handles multi-page PDF',()=>{
 const image=normalizeCloudmersiveOcr({TextResult:'  Factuur nr 103\r\n€ 17,99  ',MeanConfidenceLevel:81},'image')
 assert.deepEqual(image,{text:'Factuur nr 103\n€ 17,99',confidence:81,pages:1})
 assert.equal(normalizeCloudmersiveOcr({TextResult:'',MeanConfidenceLevel:20},'image'),null)
 assert.equal(normalizeCloudmersiveOcr({TextResult:'test',MeanConfidenceLevel:'10'},'image')?.confidence,null)
 assert.equal(normalizeCloudmersiveOcr({TextResult:'test',MeanConfidenceLevel:105},'image')?.confidence,null)
 assert.equal(normalizeCloudmersiveOcr({Successful:false,OcrPages:[{TextResult:'fake'}]},'pdf'),null)
 assert.equal(normalizeCloudmersiveOcr({AsyncJobStatus:'STARTED'},'pdf'),null)
 const pdf=normalizeCloudmersiveOcr({Successful:true,OcrPages:[{PageNumber:1,TextResult:'Page one',MeanConfidenceLevel:90},{PageNumber:2,TextResult:'Page two',MeanConfidenceLevel:60}]},'pdf')
 assert.deepEqual(pdf,{text:'Page one\n\nPage two',pages:2,confidence:75})
 assert.equal(normalizeCloudmersiveOcr({TextResult:'x'.repeat(30000)},'image')?.text.length,25000)
 assert.equal(normalizeCloudmersiveOcr(null,'image'),null)
})

test('OCR route fails closed with administration permissions, CSRF checks and bounded requests',()=>{
 const route=read('app/api/administration/ocr/route.ts')
 assert.match(route,/sameOrigin\(request\)/)
 assert.match(route,/administrationAccess\(\)/)
 assert.match(route,/if\(!access\.ok\)return reply/)
 assert.match(route,/CLOUDMERSIVE_OCR_API_KEY/)
 assert.match(route,/ocr_not_configured/)
 assert.match(route,/MAX_FILE=5\*1024\*1024/)
 assert.match(route,/stream\.getReader\(\)/)
 assert.match(route,/readBoundedForm/)
 assert.match(route,/verifiedOcrFileType\(bytes,file\.type,file\.name\)/)
 assert.match(route,/new Set\(\["NLD","ENG","FRA","DEU"\]\)/)
 assert.match(route,/https:\/\/api\.cloudmersive\.com/)
 assert.match(route,/AbortSignal\.timeout\(20_000\)/)
 assert.match(route,/recognitionMode:"Basic"/)
 assert.match(route,/Cache-Control/)
 assert.match(route,/reviewRequired:true/)
 assert.doesNotMatch(route,/service_role|SUPABASE_SERVICE_ROLE|\.from\(|\.rpc\(/)
 assert.doesNotMatch(route,/process\.env\.NEXT_PUBLIC_CLOUDMERSIVE/)
 assert.doesNotMatch(route,/request\.json\(\)/)
})

test('OCR UI is integrated once into existing finance portal and never writes financial/inventory records',()=>{
 const finance=read('app/(app)/portals/administration/finance/page.tsx')
 const panel=read('components/administration/cloudmersive-ocr-preview.tsx')
 assert.match(finance,/import CloudmersiveOcrPreview/)
 assert.equal((finance.match(/<CloudmersiveOcrPreview locale=\{locale\}\/>/g)||[]).length,1)
 assert.match(finance,/<InvoiceLineCsvImport/)
 assert.match(panel,/fetch\("\/api\/administration\/ocr"/)
 assert.match(panel,/method:"POST"/)
 assert.match(panel,/data-no-translate/)
 assert.match(panel,/result\.text/)
 assert.match(panel,/reviewRequired/)
 assert.doesNotMatch(panel,/\.rpc\(|supabase|upt_admin_receive_inventory|upt_admin_import_invoice_lines/)
 for(const locale of ['nl:','fr:','en:','de:'])assert.ok(panel.includes(locale),locale)
})


test('async PDF job identifiers are validated and user-bound HMAC tokens cannot be forged or replayed',()=>{
 const job='f71309ca-1479-49c2-a227-02170f8d2d5c'
 const user='c36c6549-0959-46c7-8964-966e92145316'
 const key='test-only-secret-never-used-in-live-worker'
 const now=Date.UTC(2026,10,9,16,0)
 assert.equal(pendingPdfJobId({AsyncJobStatus:'STARTED',AsyncJobID:job}),job)
 assert.equal(pendingPdfJobId({AsyncJobStatus:'COMPLETED',AsyncJobID:job}),null)
 assert.equal(pendingPdfJobId({AsyncJobStatus:'STARTED',AsyncJobID:'https://evil.test/?foo=x'}),null)
 assert.equal(pendingPdfJobId({AsyncJobStatus:'STARTED',AsyncJobID:'x'}),null)
 const token=signOcrJob(job,user,key,now)
 assert.equal(typeof token,'string')
 assert.ok(!token.includes(job),'provider job ID must not be exposed in a readable query string')
 assert.equal(verifyOcrJob(token,user,key,now+1000),job)
 assert.equal(verifyOcrJob(token,'another-user',key,now+1000),null)
 assert.equal(verifyOcrJob(token,user,'other-key',now+1000),null)
 assert.equal(verifyOcrJob(token,user,key,now+16*60*1000),null)
 assert.equal(verifyOcrJob(token+'.extra',user,key,now+1000),null)
 assert.equal(verifyOcrJob(token.slice(0,-1)+'x',user,key,now+1000),null)
 assert.equal(signOcrJob('invalid/id',user,key,now),null)
 assert.equal(verifyOcrJob('garbage',user,key,now),null)
})

test('pending PDF jobs poll only via authorized same-origin POST, with bounded upstream JSON',()=>{
 const route=read('app/api/administration/ocr/route.ts')
 assert.match(route,/verifyOcrJob\(pollToken,access\.user\.id,key\)/)
 assert.match(route,/if\(request\.body\)return reply\(\{error:"invalid_poll_request"\},415\)/)
 assert.match(route,/\/ocr\/pdf\/get-job-status\?/)
 assert.match(route,/new URLSearchParams\(\{AsyncJobID:id\}\)/)
 assert.match(route,/pendingPdfJobId\(parsed\)/)
 assert.match(route,/signOcrJob\(job,userId,key\)/)
 assert.match(route,/reply\(\{pending:true,token\},202\)/)
 assert.match(route,/if\(size>MAX_RESPONSE\)\{await reader\.cancel\(\);return null\}/)
 const ui=read('components/administration/cloudmersive-ocr-preview.tsx')
 assert.match(ui,/headers:\{"x-ocr-job-token":token\}/)
 assert.match(ui,/for\(let attempt=0;attempt<12;attempt\+\+\)/)
 assert.match(ui,/revision\.current/)
 assert.match(ui,/setStillProcessing\(true\)/)
 assert.match(ui,/t\.check/)
 for(const locale of ['nl:','fr:','en:','de:']) assert.ok(ui.includes(locale),locale)
})
