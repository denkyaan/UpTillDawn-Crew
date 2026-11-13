// Static coverage inventory. Reports code presence and explicitly unverified
// external delivery; it never certifies authenticated E2E or third-party access.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'

const roles=[
 {name:'Admin',route:'app/(app)/admin/page.tsx',access:'app/(app)/settings/page.tsx'},
 {name:'Administratie',route:'app/(app)/portals/administration/layout.tsx',access:'app/(app)/portals/administration/finance/page.tsx'},
 {name:'Promotie',route:'app/(app)/portals/promotion/layout.tsx',access:'app/(app)/portals/promotion/tasks/page.tsx'},
 {name:'Personeel',route:'app/(app)/events/page.tsx',access:'app/(app)/tasks/page.tsx'},
 {name:'Verantwoordelijke',route:'app/(app)/workplaces/page.tsx',access:'app/(app)/operations/page.tsx'},
 {name:'Maker',route:'app/maker-mode/page.tsx',access:'app/god-mode/page.tsx'},
]
const criticalWorkflows=[
 ['Registratie en goedkeuring','app/(auth)/login/page.tsx','app/(app)/personnel/page.tsx'],
 ['Evenementen en beschikbaarheid','app/(app)/events/page.tsx','app/(app)/workplaces/page.tsx'],
 ['Briefings en shifts','app/(app)/briefings/page.tsx','app/(app)/operations/page.tsx'],
 ['Werkuren en pauzes','app/(app)/timesheets/page.tsx','app/(app)/operations/page.tsx'],
 ['Rapportage en export','app/(app)/exports/page.tsx','app/api/administration/payroll/export/route.ts'],
 ['Chat en meldingen','app/(app)/chat/page.tsx','app/(app)/notifications/page.tsx'],
 ['Administratie en facturatie','app/(app)/portals/administration/finance/page.tsx','app/(app)/portals/administration/counterparties/page.tsx'],
 ['Promotie en bewijzen','app/(app)/portals/promotion/tasks/page.tsx','app/(app)/portals/administration/promotion-discipline/page.tsx'],
 ['Offline en push','public/sw.js','components/push-notification-settings.tsx'],
]
const integrations=[
 {name:'Peppol live aflevering',code:['app/api/administration/peppol/prepare/route.ts'],live:'unverified',dependency:'Access point, recipient discovery, delivery receipts'},
 {name:'Bankkoppeling en boekhouding',code:['app/api/administration/bank-statements/route.ts'],live:'unverified',dependency:'Bank/provider authorization and sandbox reconciliation'},
 {name:'Documenso handtekeningendienst',code:['lib/administration/documenso.ts'],live:'unverified',dependency:'Deployed signing service, credentials and signature callback'},
 {name:'OCR factuur en inventaris',code:['app/api/administration/ocr/route.ts','components/administration/cloudmersive-ocr-preview.tsx'],live:'unverified',dependency:'Cloudmersive API key, actual document recognition, invoice-line review and inventory approval'},
 {name:'Ticketing/Eventix',code:['components/administration/eventix-integration.tsx'],live:'unverified',dependency:'Provider sandbox credentials, webhook replay and reconciliation'},
 {name:'Weeztix inkomscan',code:['components/crew/weeztix-scanner-panel.tsx'],live:'unverified',dependency:'Authorized entrance scanner test'},
 {name:'SumUp merch/tokens',code:[],live:'missing-or-unverified',dependency:'Provider integration/transaction acceptance'},
 {name:'Disaster recovery',code:['scripts/verify-remote-dr-restore.sh'],live:'unverified',dependency:'Physical backup restored to isolated project'},
 {name:'Supabase leaked-password protection',code:['docs/RECOVERY_AND_RELEASE_GATE.md'],live:'unverified',dependency:'Hosted Auth configuration check'},
]
const missingRoutes=roles.flatMap(role=>[role.route,role.access].filter(path=>!existsSync(path)).map(path=>({role:role.name,path})))
const missingWorkflows=criticalWorkflows.flatMap(([name,...files])=>files.filter(path=>!existsSync(path)).map(path=>({name,path})))
const browser=readFileSync('scripts/e2e-all-portals.mjs','utf8')
const browserRoles=['admin','administration','promotion','staff','responsible','maker']
const missingBrowserRoles=browserRoles.filter(role=>!browser.includes("role:'"+role+"'"))
const missingLocales=['nl','fr','en','de'].filter(locale=>!browser.includes("'"+locale+"'"))
const workflows=['ci.yml','cleanup-actions-history.yml','deploy-cloudflare.yml','deploy-main.yml','fast-change-validation.yml']
const workflowsPresent=workflows.every(file=>existsSync(join('.github/workflows',file)))
const packageJson=JSON.parse(readFileSync('package.json','utf8'))
const dependencyLock=JSON.parse(readFileSync('package-lock.json','utf8'))
const playwrightReady=Boolean(packageJson.devDependencies?.playwright==='1.65.0'
 && dependencyLock.packages?.['']?.devDependencies?.playwright==='1.65.0'
 && dependencyLock.packages?.['node_modules/playwright']?.version==='1.65.0'
 && dependencyLock.packages?.['node_modules/playwright-core']?.version==='1.65.0'
 && packageJson.scripts?.['e2e:portals']==='node scripts/e2e-all-portals.mjs')
const mainWorkflow=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
const releaseWorkflow=readFileSync('.github/workflows/ci.yml','utf8')
// Main deliberately has no browser job. Six-role QA gates only production release.
const qaJobAvailable=!mainWorkflow.includes('browser-acceptance:')&&!mainWorkflow.includes('full-validation:')
 && releaseWorkflow.includes('Six-role 4-language mobile and desktop authenticated acceptance (isolated)')
 && releaseWorkflow.includes('Run 15 concurrent authenticated browser bots')
const summary={
 source:'static-source-audit',
 note:'File/contract presence is not successful live execution or a production release certificate.',
 roles:roles.map(role=>({name:role.name,implementationPresent:existsSync(role.route)&&existsSync(role.access),authenticatedBrowserVerified:false})),
 criticalWorkflows:criticalWorkflows.map(([name,...files])=>({name,sourceFilesPresent:files.every(path=>existsSync(path)),endToEndVerified:false})),
 integrations:integrations.map(item=>({...item,codePresent:item.code.length>0&&item.code.every(path=>existsSync(path)),liveVerified:false})),
 releaseChecks:{sixRoleBrowserHarness:!missingBrowserRoles.length,playwrightReady,qaJobAvailable,fourLanguages:!missingLocales.length,exactlyFiveWorkflows:workflowsPresent},
 blockers:[
  'Authenticated six-role browser matrix not executed by this static job',
  'Production schema/permission acceptance not executed on main CI',
  'External provider live delivery and callback tests not verified',
  'Physical backup restored into a separate project not verified',
  'Real iPhone/Android user journeys not independently verified',
 ],
 checkedAt:new Date().toISOString()
}
mkdirSync('artifacts',{recursive:true})
writeFileSync('artifacts/final-main-acceptance-inventory.json',JSON.stringify(summary,null,2)+'\n')
console.log('Final acceptance inventory (STATIC ONLY)')
for(const role of summary.roles)console.log((role.implementationPresent?'SOURCE PRESENT':'MISSING')+' role '+role.name)
for(const item of summary.integrations)console.log('UNVERIFIED external '+item.name+(item.codePresent?' (integration code present)':' (integration implementation unconfirmed)'))
console.log('PENDING real E2E and external providers; no production-ready claim.')
if(missingRoutes.length||missingWorkflows.length||missingBrowserRoles.length||missingLocales.length||!workflowsPresent||!playwrightReady||!qaJobAvailable){
 console.error(JSON.stringify({missingRoutes,missingWorkflows,missingBrowserRoles,missingLocales,workflowsPresent,playwrightReady,qaJobAvailable}))
 process.exitCode=1
}
