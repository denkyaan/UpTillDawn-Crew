import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('Maker controlroom provides five task-focused workspaces and shared diagnostics',async()=>{
 const [page,studio,source]=await Promise.all([
  read('app/god-mode/page.tsx'),
  read('components/god-mode/god-studio.tsx'),
  read('app/api/god/source/route.ts'),
 ])
 for(const name of ['Overzicht','Fouten & logs','AI-assistent','Layout','Technisch'])
  assert.ok(studio.includes(name),'Missing main workspace: '+name)
 for(const tool of ['automations','source','elements','data','sql','roles','versions','connections'])
  assert.match(studio,new RegExp("'"+tool+"'"))
 assert.match(studio,/tab==='monitor'/)
 assert.match(studio,/tab==='overview'/)
 assert.match(studio,/setTab\('ai'\);setTextAiPrompt\(recoveryPrompt\(report\)\)/)
 assert.match(studio,/filteredReports\.map/)
 assert.match(studio,/securityAudit/)
 assert.match(page,/securityAudit=\{<UploadSecurityAudit/)
 assert.match(source,/action === 'operations'/)
 assert.match(source,/approved = new Set/)
 assert.match(source,/source:'github-actions'/)
 assert.match(source,/authorizeStudio\(request\)/)
})
test('God Mode SQL never targets production or executes outside main-test',async()=>{
 const [api,editor]=await Promise.all([
  read('app/api/god/sql/route.ts'),
  read('components/god-mode/god-sql-editor.tsx'),
 ])
 assert.match(api,/const PROJECT = 'npbjrtiolqperdgljnhi'/)
 assert.match(api,/function enforceMainTestDatabase/)
 assert.match(api,/NEXT_PUBLIC_SUPABASE_URL/)
 assert.equal((api.match(/enforceMainTestDatabase\(\)/g)||[]).length,3)
 assert.doesNotMatch(api,/const PROJECT = 'eakoavcieossazqzplke'/)
 assert.match(editor,/main-testdatabase/)
 assert.match(editor,/write&&!confirmed/)
})
test('Publishing a God Mode patch only merges to main after successful CI main PR checks',async()=>{
 const source=await read('app/api/god/source/route.ts')
 assert.match(source,/fast-change-validation\.yml\/runs/)
 assert.match(source,/run\.event === 'pull_request'/)
 assert.match(source,/run\.head_sha === body\.sha/)
 assert.match(source,/run\.head_branch === pull\.head\.ref/)
 assert.match(source,/latest\.conclusion !== 'success'/)
 assert.match(source,/Productie wordt niet automatisch gestart of gewijzigd/)
 assert.doesNotMatch(source,/Cloudflare start de gekoppelde productiebuild/)
})
