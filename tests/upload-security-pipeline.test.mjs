import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const security=readFileSync('lib/upload-security.ts','utf8')
const queue=readFileSync('lib/crew-queue.ts','utf8')
const actions=readFileSync('lib/actions/uptilldawn.ts','utf8')
const guestlist=readFileSync('app/api/guestlist/import/route.ts','utf8')

test('central upload security validates real file signatures and executable names',()=>{
 assert.match(security,/signatureMatches/)
 assert.match(security,/executableExtensions/)
 assert.match(security,/doubleExtension/)
 assert.match(security,/file\.slice\(0,4096\)\.arrayBuffer/)
 assert.match(security,/UPLOAD_LIMITS/)
})

test('realtime chat and incident uploads use fast validation before storage',()=>{
 assert.match(queue,/await validateUploadSecurity\(file/)
 assert.match(queue,/allowDocuments:false/)
 const validation=queue.indexOf('await validateUploadSecurity(file')
 const enqueue=queue.indexOf('await writeUpload(upload)')
 assert.ok(validation>=0&&enqueue>validation)
})

test('managed documents and work media share central validation',()=>{
 assert.match(actions,/await validateUploadSecurity\(file\)/)
 assert.match(actions,/await validateUploadSecurity\(fileValue\)/)
 assert.match(actions,/safeUploadName\(fileValue\.name\)/)
})

test('guestlist validates supported binary uploads before parsing',()=>{
 assert.match(guestlist,/validateUploadSecurity\(file\)/)
 assert.ok(guestlist.indexOf('validateUploadSecurity(file)')<guestlist.indexOf('const entries=await parseUpload(file)'))
})
