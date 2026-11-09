import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Deploy main checks only its own OCR secret binding by name and never leaks values',()=>{
 const source=read('.github/workflows/deploy-main.yml')
 assert.match(source,/name: Deploy main/)
 assert.match(source,/Verify OCR secret binding on main Worker \(names only\)/)
 assert.match(source,/accounts\/\$\{account\}\/workers\/scripts\/uptilldawn-main\/secrets/)
 assert.match(source,/metadata\.result\.some\(entry => entry\?\.name === 'CLOUDMERSIVE_OCR_API_KEY'\)/)
 assert.match(source,/headers: \{Authorization: `Bearer \$\{token\}`\}/)
 assert.match(source,/Secret name present: \*\*/)
 assert.match(source,/Legacy Cloudmersive OCR smoke test: disabled; local OCR is the default/)
 assert.doesNotMatch(source,/console\.log\(metadata\)|console\.log\(token\)|console\.log\(account\)|process\.stdout\.write\(JSON\.stringify\(metadata/)
 assert.match(source,/if: steps\.current-main\.outputs\.current == 'true'/)
 assert.match(source,/Main deployment is eligible/)
 assert.match(source,/Deploy main test Worker only/)
 assert.doesNotMatch(source,/npx wrangler secret put|secrets-bulk|workers\/scripts\/uptilldawn-production\/secrets/)
})

test('OCR endpoint publicly fails closed before reaching the external OCR provider',()=>{
 const route=read('app/api/administration/ocr/route.ts')
 const deploy=read('.github/workflows/deploy-main.yml')
 const access=read('lib/administration/access.ts')
 const origin=route.indexOf('if(!sameOrigin(request))')
 const roles=route.indexOf('const access=await administrationAccess()')
 const credentials=route.indexOf('const key=process.env.CLOUDMERSIVE_OCR_API_KEY')
 const provider=route.indexOf('await fetch("https://api.cloudmersive.com"+path')
 assert.ok(origin>=0&&roles>origin&&credentials>roles&&provider>credentials)
 assert.match(access,/upt_can_manage_administration/)
 assert.match(deploy,/Verify OCR endpoint denies unauthenticated requests/)
 assert.match(deploy,/response_code.*401.*403/)
 assert.match(deploy,/Main OCR unauthenticated request: HTTP/)
 assert.doesNotMatch(deploy,/CLOUDMERSIVE_OCR_API_KEY\s*:\s*\$\{\{\s*secrets\./)
})
