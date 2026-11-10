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
test('God Mode SQL selects only fixed projects and rejects unreviewed production writes',async()=>{
 const [api,editor,projects]=await Promise.all([
  read('app/api/god/sql/route.ts'),
  read('components/god-mode/god-sql-editor.tsx'),
  read('lib/god-environments.ts'),
 ])
 assert.match(projects,/npbjrtiolqperdgljnhi/)
 assert.match(projects,/eakoavcieossazqzplke/)
 assert.match(projects,/function isApprovedRuntime/)
 assert.match(projects,/function canWriteGodSql/)
 assert.match(api,/guardRuntime/)
 assert.match(api,/body\.environment==='production'&&body\.write/)
 assert.match(api,/GOD_PROJECTS\[environment\]\.projectId/)
 assert.match(api,/read_only:readOnly/)
 assert.match(editor,/environment==='production'/)
})
test('God Mode reports for production use a fixed bounded read-only query',async()=>{
 const report=await read('app/api/god/error-reports/route.ts')
 assert.match(report,/environment==='production'/)
 assert.match(report,/GOD_PROJECTS\.production\.projectId/)
 assert.match(report,/read_only:true/)
 assert.match(report,/limit \${limit}/)
 assert.match(report,/authorizeStudio\(request\)/)
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
