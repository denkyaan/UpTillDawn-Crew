import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
test('home and administrative status links never schedule unnecessary Next SSR prefetch',()=>{
 for(const path of ['app/(app)/page.tsx','components/administration/administration-subtab-status.tsx']){
  const links=read(path).match(/<Link\b[^>]*>/g)||[]
  assert.ok(links.length>0,path)
  for(const link of links)assert.ok(link.includes('prefetch={false}'),link)
 }
})
test('strict live comparison frees unused login documents and retains all comparisons',()=>{
 const roles=read('modern/tests/browser-auth-qa.mjs'),deep=read('modern/tests/deep-route-parity-qa.mjs')
 assert.ok(roles.includes('await page.close()'))
 assert.ok(deep.includes('await login.close()'))
 assert.ok(roles.includes('if(signins!==7||total!==56)'))
 assert.ok(deep.includes('if(signins!==7||validated!==EXPECTED)'))
 assert.ok(deep.includes('DEEP_PARITY_MISMATCHES'))
 assert.ok(roles.includes('QA_ORIGINAL_COMPARISONS_FAILED'))
 const workflow=read('.github/workflows/deploy-main.yml')
 const diag=workflow.split('Report legacy Main runtime outcomes separately from new candidate health')[1].split('run: node scripts/main-worker-outcomes.mjs')[0]
 assert.ok(diag.includes('MAIN_WORKER_DEPLOYED_AT: ${{ needs.deploy.outputs.deployed_at }}'))
})
