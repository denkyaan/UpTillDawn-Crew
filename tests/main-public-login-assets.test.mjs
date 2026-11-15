import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {publishLoginAssets,PUBLIC_LOGIN_ROUTES} from '../scripts/publish-main-login-assets.mjs'

test('Main publishes only verified SSG public login shells as direct assets, with original CSP',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'upt-main-logins-'))
 try{
  const nextRoot=path.join(root,'.next'),assetRoot=path.join(root,'.open-next','assets')
  mkdirSync(path.join(nextRoot,'server','app','(auth)','login'),{recursive:true})
  const routes={}
  for(const route of PUBLIC_LOGIN_ROUTES){
   const portal=route.split('/')[2]
   routes[route]={initialRevalidateSeconds:false}
   const html='<html><body><form data-login-hydrated="false"><input name="portal" value="'+portal+'"></form></body></html>'
   writeFileSync(path.join(nextRoot,'server','app','(auth)',route.slice(1)+'.html'),html)
  }
  writeFileSync(path.join(nextRoot,'prerender-manifest.json'),JSON.stringify({routes}))
  const result=await publishLoginAssets({nextRoot,assetRoot})
  assert.equal(result.length,4)
  for(const route of PUBLIC_LOGIN_ROUTES){
   const name=path.join(assetRoot,route.slice(1)+'.html')
   assert.ok(existsSync(name),route)
   assert.ok(readFileSync(name,'utf8').includes('value="'+route.split('/')[2]+'"'))
  }
  assert.ok(!existsSync(path.join(assetRoot,'login','admin.html')))
  assert.ok(!existsSync(path.join(assetRoot,'admin.html')))
  assert.ok(!existsSync(path.join(assetRoot,'events.html')))
  const headers=readFileSync(path.join(assetRoot,'_headers'),'utf8')
  for(const route of PUBLIC_LOGIN_ROUTES)assert.ok(headers.includes(route+'\n'),route)
  assert.match(headers,/Content-Security-Policy:/)
  assert.match(headers,/X-Frame-Options: SAMEORIGIN/)
  assert.match(headers,/X-UpTillDawn-Static-Login: 1/)
  assert.match(headers,/Cache-Control: no-store/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('publishing fails closed and leaves no assets on partial or dynamic builds',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'upt-main-logins-invalid-'))
 try{
  const nextRoot=path.join(root,'.next'),assetRoot=path.join(root,'.open-next','assets')
  mkdirSync(path.join(nextRoot,'server','app','login'),{recursive:true})
  writeFileSync(path.join(nextRoot,'prerender-manifest.json'),JSON.stringify({routes:{'/login/staff':{initialRevalidateSeconds:false}}}))
  writeFileSync(path.join(nextRoot,'server','app','login','staff.html'),'<html>not an approved role login shell</html>')
  await assert.rejects(publishLoginAssets({nextRoot,assetRoot}),/not the expected anonymous/)
  assert.ok(!existsSync(path.join(assetRoot,'login','staff.html')))
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('only Deploy main publishes static login assets, no new workflows or production modifications',()=>{
 const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
 assert.match(workflow,/node scripts\/publish-main-login-assets\.mjs/)
 assert.match(workflow,/Static Cloudflare Asset verified:/)
 assert.match(workflow,/x-uptilldawn-static-login: 1/)
 assert.ok(workflow.indexOf('Build main app Worker')<workflow.indexOf('node scripts/publish-main-login-assets.mjs'))
 assert.ok(workflow.indexOf('node scripts/publish-main-login-assets.mjs')<workflow.indexOf('Validate Worker bundle'))
 const production=readFileSync('.github/workflows/deploy-cloudflare.yml','utf8')
 assert.doesNotMatch(production,/publish-main-login-assets/)
 const wrangler=JSON.parse(readFileSync('wrangler.main.jsonc','utf8'))
 assert.equal(wrangler.assets.directory,'.open-next/assets')
 assert.notEqual(wrangler.assets.run_worker_first,true)
})
