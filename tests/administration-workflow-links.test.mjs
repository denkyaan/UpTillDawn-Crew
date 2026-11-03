import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {administrationWorkflowLinks,administrationWorkflowHref} from '../lib/administration/workflow-links.ts'
test('administration workflow targets exist and never loop to the current module',()=>{
 for(const [slug,href] of Object.entries(administrationWorkflowLinks)){
  assert.equal(administrationWorkflowHref(slug),href)
  assert.notEqual(href,'/portals/administration/modules/'+slug)
  if(href.startsWith('#'))assert.equal(slug,'tasks')
  else {
   const dir='app/(app)'+href
   assert.ok(existsSync(dir+'/page.tsx')||existsSync(dir+'/route.ts'),href+' is missing')
  }
 }
})
test('unsupported module actions are not presented as working links',()=>{
 for(const slug of ['inventory','notifications','marketing','settings','automations','permits'])assert.equal(administrationWorkflowHref(slug),null)
 const page=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(page,/administrationWorkflowHref\(slug\)/)
 assert.ok(!page.includes('operationalModuleLinks'))
})
