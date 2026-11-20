// Seven-domain migration preflight. The authoritative sources determine
// coverage. This does NOT claim successful business-action E2E equivalence.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {actionEntries,filesBelow,parse,pages,routePath,ts} from '../tooling/main-source.mjs'
import {originalMainRoutes} from '../src/api/main-routes.ts'
import {originalApiAllowed} from '../src/api/main-source.ts'
import {verifyOriginalActionRegistry} from '../tooling/action-registry-contract.mjs'

const read=(file)=>readFileSync(file,'utf8')
const exportsMethod=(node)=>{
 const modifiers=node.modifiers??[]
 return modifiers.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)
}
const verbs=new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'])
function handlers(file){
 const methods=new Set()
 for(const statement of parse(file).statements){
  if(!exportsMethod(statement))continue
  if(ts.isFunctionDeclaration(statement)&&statement.name&&verbs.has(statement.name.text))
   methods.add(statement.name.text)
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations){
   const name=d.name.getText()
   if(verbs.has(name))methods.add(name)
  }
  if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause))
   for(const e of statement.exportClause.elements)if(verbs.has(e.name.text))methods.add(e.name.text)
 }
 return [...methods].sort()
}
function pattern(file){
 return '/'+file.replace(/^app\//,'').replace(/\/route\.tsx?$/,'').split('/')
  .filter(segment=>!(/^\(.+\)$/.test(segment)))
  .map(segment=>/^\[.+\]$/.test(segment)?'[^/]+':segment).join('/')
}
const apiFiles=filesBelow('app').filter(file=>/\/route\.tsx?$/.test(file)).sort()
const pageFiles=filesBelow('app').filter(file=>/\/page\.tsx?$/.test(file))
test('all 64 original API routes and exact HTTP methods remain exposed only through the committed allowlist',()=>{
 assert.equal(apiFiles.length,64,'Source API inventory changed: review every new/removed original endpoint')
 assert.equal(originalMainRoutes.length,apiFiles.length,
  'The lightweight Worker cannot silently omit or add original Main API routes')
 const seen=new Set()
 for(const file of apiFiles){
  const expectedPattern=pattern(file),route=originalMainRoutes.find(x=>x.pattern===expectedPattern)
  assert.ok(route,'Missing original Main API route: '+file)
  assert.ok(!seen.has(expectedPattern),'Duplicate original API route: '+expectedPattern)
  seen.add(expectedPattern)
  const declared=handlers(file)
  assert.ok(declared.length>0,'No exported HTTP method declarations: '+file)
  assert.deepEqual([...route.methods].sort(),declared,'Original API method drift at '+file)
  const sample=expectedPattern.replaceAll('[^/]+','fixture')
  for(const method of verbs){
   assert.equal(originalApiAllowed(sample,method),declared.includes(method),
    'Incorrect whitelist for '+method+' '+file)
  }
 }
})
test('all original application routes, screens, roles and locale sources remain present',()=>{
 assert.equal(pageFiles.length,101,'Every original page change requires a fresh 1:1 parity review')
 const appPages=pageFiles.filter(f=>f.startsWith('app/(app)/'))
 assert.equal(appPages.length,81)
 assert.ok(appPages.every(x=>pages.includes(x)),'Original Vite router must use every app page')
 for(const f of ['app/maker-mode/page.tsx','app/god-mode/page.tsx','app/god-mode/login/page.tsx',
   'app/god-mode/setup/page.tsx','app/qr/page.tsx','app/q/[code]/page.tsx'])
  assert.ok(pages.includes(f),'Original special route omitted: '+f)
 assert.equal(new Set(pages.map(routePath)).size,pages.length,'Ambiguous original page paths')
 const auth=read('modern/src/screens/original-auth.tsx')
 const app=read('modern/src/screens/original-application.tsx')
 for(const preserved of ['LoginPage','LoginForm','SignupPage','ResetPasswordPage','PendingApproval','ForgotPasswordForm'])
  assert.ok(auth.includes(preserved),'Original auth screen removed: '+preserved)
 for(const preserved of ['AppLayout','AdministrationLayout','PromotionLayout','AdminSelectionProvider',
   'WorkspaceContinuity','LazyOfflineContentSync','Toaster']){
  // The offline sync is within the reused original app layout.
  assert.ok((app+read('app/(app)/layout.tsx')).includes(preserved),
   'Original app shared UX/service removed: '+preserved)
 }
 for(const locale of ['nl','fr','en','de'])
  assert.ok(read('modern/tests/browser-auth-qa.mjs').includes("'"+locale+"'"))
})
test('every original server action stays on an explicit server-only allowlist',()=>{
 const source=actionEntries().map(x=>x.id)
 const registry=read('lib/migration/original-action-registry.ts')
 const result=verifyOriginalActionRegistry(source,registry)
 assert.ok(result.sourceCount>=163,'Original business action source unexpectedly shrank')
 assert.equal(result.sourceCount,result.registeredCount)
 assert.ok(registry.includes('import "server-only"'))
 const api=read('modern/src/api/worker.ts')
 assert.ok(api.includes('UPT_MIGRATION_ALLOW_WRITES!=="true"'))
 assert.ok(api.includes('path==="/api/migration/view-data"'))
})
test('payments, providers, scans and bank imports require signed original Main authority',()=>{
 const expected=[
  '/api/administration/integrations',
  '/api/administration/integrations/ponto',
  '/api/administration/integrations/weeztix/start',
  '/api/administration/integrations/oauth/sumup/start',
  '/api/weeztix/scan',
  '/api/administration/bank-statements',
  '/api/administration/finance/invoice-lines/import',
  '/api/administration/peppol/prepare',
  '/api/administration/payroll/export'
 ]
 const allowed=new Set(originalMainRoutes.map(x=>x.pattern))
 for(const path of expected){
  const regex=path.replace('/sumup/','/[^/]+/')
  assert.ok(allowed.has(regex),'Provider integration transport missing: '+path)
 }
 const config=JSON.parse(read('modern/wrangler.main-qa.jsonc'))
 assert.equal(config.vars.UPT_MIGRATION_ALLOW_WRITES,'false')
 assert.equal(config.vars.UPT_MIGRATION_SCANNING_ENABLED,'false')
 assert.equal(config.vars.UPT_MIGRATION_OAUTH_ENABLED,'false')
 assert.equal(config.vars.SUPABASE_URL,'https://npbjrtiolqperdgljnhi.supabase.co')
 assert.ok(config.services.find(x=>x.binding==='MAIN_AUTH'))
})
test('offline/PWA and fast, isolated Main delivery remain preserved without production triggers',()=>{
 const original=read('app/(app)/layout.tsx'),candidate=read('modern/src/main.tsx')
 for(const token of ['LazyOfflineContentSync','ErrorReportBridge','ReturnAfterLogin'])
  assert.ok(original.includes(token),'Original PWA/offline function missing: '+token)
 assert.ok(candidate.includes("serviceWorker.register('/sw.js')"))
 const workflow=read('.github/workflows/deploy-main.yml')
 assert.ok(workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(workflow.includes("qa-modern-main-qa:"))
 assert.ok(workflow.includes("Compare original Main login"))
 assert.ok(workflow.includes("Compare 22 deep original pages"))
 const fast=read('.github/workflows/fast-change-validation.yml')
 assert.ok(fast.includes('branches: [main]'))
 assert.ok(fast.includes('release_production'))
 assert.ok(fast.includes("github.event_name == 'workflow_dispatch' && inputs.release_production == true"))
})
