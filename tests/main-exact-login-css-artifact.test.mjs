import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectLoginCss,loginCssManifest} from '../scripts/export-main-login-css.mjs'
import {retrieveLoginCss} from '../scripts/retrieve-main-login-css.mjs'
const sha='a'.repeat(40)
test('the exact ordered original CSS is exported without color conversion, HTML or JS',()=>{
 const dir=mkdtempSync(join(tmpdir(),'upt-login-css-'))
 try{
  const css='.auth-portal-screen{background:lab(2.51107 0.242703 -0.886115)}'
  const second='.auth-portal-card{color:oklab(0.141 0.00136173 -0.00480696 / 0.7)}'
  mkdirSync(join(dir,'_next/static/chunks'),{recursive:true})
  writeFileSync(join(dir,'_next/static/chunks/a.css'),css)
  writeFileSync(join(dir,'_next/static/chunks/b.css'),second)
  for(const role of ['staff','responsible','admin','promotion','administration']){
   mkdirSync(join(dir,'login',role),{recursive:true})
   writeFileSync(join(dir,'login',role,'index.html'),'<html><link href="/_next/static/chunks/a.css" rel="stylesheet"><link rel="stylesheet" href="/_next/static/chunks/b.css"><script src="/private.js"></script></html>')
  }
  const result=collectLoginCss(dir,sha)
  assert.equal(result.sha,sha)
  assert.deepEqual(result.routes['/login/admin'],['/_next/static/chunks/a.css','/_next/static/chunks/b.css'])
  assert.deepEqual(Object.values(result.sheets),[css,second])
  assert.equal(Object.keys(result.routes).length,5)
  assert.throws(()=>collectLoginCss(dir,'wrong'),/INVALID_SHA/)
  writeFileSync(join(dir,'_next/static/chunks/a.css'),'.auth-portal-screen{background:url(../relative.png)}')
  assert.throws(()=>collectLoginCss(dir,sha),/RELATIVE_OR_EXTERNAL_URL/)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('same-run Main public CSS manifest required for deployed candidate; local fallback and strict screenshot gate remain',()=>{
 const wf=readFileSync('.github/workflows/deploy-main.yml','utf8')
 const vite=readFileSync('modern/vite.config.ts','utf8')
 const auth=readFileSync('modern/src/screens/original-auth.tsx','utf8')
 assert.match(wf,/node scripts\/export-main-login-css\.mjs/)
 assert.ok(wf.includes('MAIN_LOGIN_CSS_MANIFEST: ${{ needs.deploy.outputs.login_css_manifest }}'))
 assert.ok(wf.includes('login_css_manifest: ${{ steps.login-css-export.outputs.manifest }}'))
 assert.ok(wf.includes('node scripts/retrieve-main-login-css.mjs'))
 assert.ok(!wf.includes('Download exact original Main CSS'))
 assert.ok(wf.includes('UPT_EXACT_MAIN_LOGIN_CSS_SHA: ${{ github.event.workflow_run.head_sha }}'))
 assert.ok(vite.includes('EXACT_MAIN_LOGIN_CSS_SHA_MISMATCH'))
 assert.ok(vite.includes('EXACT_MAIN_LOGIN_CSS_INCOMPLETE'))
 assert.ok(auth.includes('__UPT_EXACT_MAIN_LOGIN_CSS__?.routes[pathname]'))
 assert.ok(auth.includes(':<style>{styles}</style>'))
 assert.ok(!readFileSync('.github/workflows/deploy-cloudflare.yml','utf8').includes('export-main-login-css'))
 const gate=readFileSync('modern/tests/login-parity-qa.mjs','utf8')
 assert.ok(gate.includes('pixels.equals(modern.pixels)'))
 assert.ok(gate.includes('pixelTolerance:0'))
})

test('exact published bytes are reconstructed, transient fetch failures retried; mismatches and unsafe paths rejected',async()=>{
 const href='/_next/static/chunks/abc.css'
 const css='.auth-portal-screen{background:lab(2.51107 0.242703 -0.886115)}'
 const routes=Object.fromEntries(['staff','responsible','admin','promotion','administration'].map(role=>['/login/'+role,[href]]))
 const payload={sha,routes,sheets:{[href]:css}}
 const manifest=loginCssManifest(payload)
 let calls=0
 const response=body=>new Response(body,{headers:{'content-type':'text/css'}})
 const reconstructed=await retrieveLoginCss(manifest,sha,{fetcher:async(url,options)=>{
  assert.equal(url,'https://uptilldawn-main.uptilldawn.workers.dev'+href)
  assert.equal(options.redirect,'error')
  if(++calls===1)throw Error('transient DNS')
  return response(css)
 },sleep:async()=>{}})
 assert.equal(calls,2)
 assert.deepEqual(reconstructed,payload)
 await assert.rejects(retrieveLoginCss(manifest,sha,{fetcher:async()=>response(css.replace('lab','rgb')),retries:1}),/DIGEST_MISMATCH/)
 await assert.rejects(retrieveLoginCss(manifest,sha,{fetcher:async()=>new Response('<html>') ,retries:1}),/CONTENT_TYPE/)
 await assert.rejects(retrieveLoginCss(manifest,'b'.repeat(40)),/SHA_MISMATCH/)
 await assert.rejects(retrieveLoginCss({...manifest,routes:{...routes,'/login/admin':['https://evil.invalid/file.css']}},sha),/INVALID_ROUTE/)
})
