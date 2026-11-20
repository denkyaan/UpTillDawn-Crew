import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')

test('financial E2E checks scanner quarantine before any simulated release',()=>{
 const source=read('scripts/administration-completion-e2e.mjs')
 const pending=source.indexOf("assert.equal(pendingScan?.status,'pending'")
 const denied=source.indexOf(")).status(),423,'Pending uploads")
 const synthetic=source.indexOf("const scannerFixture=createClient")
 const download=source.indexOf("const [download]=await Promise.all(")
 assert.ok(pending>0&&denied>pending&&synthetic>denied&&download>synthetic)
 assert.match(source,/getByRole\('link',\{name:attachmentName,exact:true\}\)\.count\(\),0/)
 assert.match(source,/status:'clean',engine:'isolated-ci-synthetic'/)
 assert.match(source,/synthetic:true/)
 assert.match(source,/\.eq\('status','pending'\)/)
})

test('synthetic scan cannot run for other hosts, databases or workflows',()=>{
 const source=read('scripts/administration-completion-e2e.mjs')
 const workflow=read('.github/workflows/ci.yml')
 assert.match(source,/UPT_E2E_ALLOW_SYNTHETIC_SCAN!=='1'/)
 assert.match(source,/localDatabase\.hostname!=='127\.0\.0\.1'/)
 assert.match(source,/localDatabase\.port!=='54322'/)
 assert.match(source,/BOT_SERVICE_ROLE_KEY/)
 assert.match(workflow,/name: Transactional administration workflow E2E\n\s+env:\n[\s\S]*?UPT_E2E_ALLOW_SYNTHETIC_SCAN: "1"\n\s+run: node scripts\/administration-completion-e2e\.mjs/)
 assert.equal((workflow.match(/UPT_E2E_ALLOW_SYNTHETIC_SCAN:/g)||[]).length,1)
})

test('Peppol approval selects exactly one visible invoice-specific action',()=>{
 const source=read('scripts/administration-peppol-e2e.mjs')
 assert.match(source,/form:visible:has\(input\[name="document_id"/)
 assert.match(source,/button\[type="submit"\]:visible/)
 assert.match(source,/assert\.equal\(await approval\.count\(\),1/)
 assert.doesNotMatch(source,/await submit\(admin\.page,approval\.first\(\)\)/)
})
