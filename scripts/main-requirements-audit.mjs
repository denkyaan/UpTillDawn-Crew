import {existsSync,readFileSync,readdirSync,appendFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

/**
 * Source-evidence inventory, not a certificate of working external integrations.
 * Code presence, isolated E2E, live Main sessions and real supplier transactions
 * are different evidence levels and must never be treated as interchangeable.
 */
export const requirements=[
 {id:'maker-owner-role-separation',name:'Maker/Owner separated from Admin + two staff roles',
  status:'code-and-isolated-tests',source:[
   'components/admin/personnel-two-role-editor.tsx',
   'supabase/migrations/20261110110000_separate_owner_from_leadership_and_directories.sql',
  ],tests:['tests/owner-separation-regression.test.mjs','tests/portal-role-atomic-contract.test.mjs']},
 {id:'navigation',name:'Six portal modes, responsive submenus and no duplicate tools',
  status:'code-and-isolated-tests',source:[
   'components/administration/administration-navigation.tsx',
   'components/promotion/promotion-bottom-nav.tsx',
   'components/layout/navigation-items.ts',
  ],tests:['tests/unified-mobile-admin-administration-navigation.test.mjs','tests/navigation-category-collapse-regression.test.mjs']},
 {id:'crew-planning',name:'Availability, event shifts, check-in, break and time approval',
  status:'code-and-isolated-tests',source:[
   'components/crew/workplace-shift-planner.tsx',
   'components/crew/timesheet-controls.tsx',
   'components/crew/qr-shift-request.tsx',
  ],tests:['tests/crew-availability-shift-response-integrity.test.mjs','tests/break-compliance.test.mjs','tests/timesheet-approval.test.mjs']},
 {id:'crew-driver-workplaces',name:'Driver and lockers/stage managers workposts',
  status:'code-and-isolated-tests',source:[
   'components/crew/driver-transport-form.tsx',
   'supabase/migrations/20261111083000_add_lockers_and_stage_managers_workplaces.sql',
  ],tests:['tests/sql/standard-lockers-stage-managers-workplaces.sql','tests/workplaces-shifts-integration.test.mjs']},
 {id:'crew-briefing',name:'Automated event/post briefings and acknowledgement',
  status:'code-and-isolated-tests',source:[
   'components/crew/briefing-analysis-fields.tsx',
  ],tests:['tests/crew-briefing-runtime.test.mjs','tests/crew-event-briefing-entry.test.mjs']},
 {id:'role-chat-promotion',name:'Role-scoped chats, promotion messages and read status',
  status:'code-and-isolated-tests',source:[
   'components/promotion/promotion-chats-client.tsx',
   'components/crew/chat-client.tsx',
  ],tests:['tests/promotion-chat-private-replies-read-security.test.mjs','tests/role-scoped-standard-chat-contract.test.mjs']},
 {id:'promotion-evidence',name:'Promotion tasks, proof and strike safeguards',
  status:'code-and-isolated-tests',source:[
   'components/promotion/promotion-publication-links.tsx',
  ],tests:['tests/promotion-evidence-security.test.mjs','tests/promotion-discipline-security.test.mjs']},
 {id:'administration-finance',name:'Documents, invoices, bank reconciliation and inventory',
  status:'code-and-isolated-tests',source:[
   'components/administration/bank-statement-workspace.tsx',
   'components/administration/provider-bank-settlement-workspace.tsx',
  ],tests:['tests/administration-payments.test.mjs','tests/provider-bank-settlement.test.mjs']},
 {id:'administration-contracts',name:'DJ agreements, contract documents and signing ledger',
  status:'code-and-isolated-tests',source:[
   'app/(app)/portals/administration/modules/artists/[id]/agreement/page.tsx',
  ],tests:['tests/contract-signing-ledger-invariants.test.mjs','tests/contract-dispatch-readiness.test.mjs']},
 {id:'peppol',name:'Invoice UBL/Peppol preparation and export',
  status:'code-and-isolated-tests',source:[
   'components/administration/peppol-preparation.tsx',
  ],tests:['tests/administration-peppol.test.mjs','tests/sql/administration-peppol-integration.sql']},
 {id:'weeztix-scanner',name:'Native entrance-only Weeztix scan integration',
  status:'code-and-isolated-tests',source:[
   'components/crew/weeztix-scanner-panel.tsx',
  ],tests:['tests/weeztix-in-app-scan.test.mjs','tests/weeztix-scanner.test.mjs']},
 {id:'god-mode-owner-studio',name:'Owner-only God Mode source editor and Maker sessions',
  status:'code-and-isolated-tests',source:[
   'components/god-mode/god-studio.tsx',
   'scripts/god-mode-maker-e2e.mjs',
  ],tests:['tests/god-mode-maker-e2e-contract.test.mjs','tests/god-mode-auth-hardening.test.mjs']},
 {id:'god-mode-error-ai',name:'Error-AI calibration, incident triage and audited closure',
  status:'code-and-isolated-tests',source:[
   'lib/god-mode-resolution-evidence.ts',
   'lib/god-mode-error-triage.ts',
  ],tests:['tests/god-mode-verified-error-closure.test.mjs','tests/error-ai-runtime-adversarial.test.mjs']},
 {id:'god-mode-cloudflare-logs',name:'Owner-only Cloudflare runtime log reader for Main and production',
  status:'code-and-isolated-tests-live-maker-query-unverified',source:[
   'app/api/god/cloudflare-logs/route.ts',
   'components/god-mode/maker-logs.tsx',
  ],tests:['tests/god-mode-cloudflare-live-log-api.test.mjs']},
 {id:'internationalization',name:'Four languages and language-synced chat',
  status:'code-and-isolated-tests',source:[
   'lib/ui-translation-catalog-app-extra.ts',
  ],tests:['tests/ui-translation-coverage.test.mjs','tests/chat-live-translation.test.mjs']},
 {id:'eventpay-reconciliation',name:'EventPay card-related statement import and top-up accounting',
  status:'code-and-isolated-tests',source:[
   'supabase/migrations/20261112062000_eventpay_readonly_statement_reconciliation.sql',
   'docs/EVENTPAY_CASHLESS_BAR_MERCH_TOKENS.md',
  ],tests:['tests/eventpay-cashless-reconciliation.test.mjs']},
 {id:'eventpay-checkout',name:'Live RFID/QR bar, merch and top-up checkout using EventPay',
  status:'not-implemented-external-provider-spec-needed',source:[
   'docs/EVENTPAY_CASHLESS_BAR_MERCH_TOKENS.md',
  ],tests:['tests/eventpay-cashless-reconciliation.test.mjs']},
 {id:'seven-role-bots',name:'Seven persistent role-specific test bots',
  status:'not-demonstrated-by-existing-fixtures',source:[
   'scripts/seed-15-bot-users.mjs','scripts/e2e-all-portals.mjs',
  ],tests:['tests/portal-multi-role-entry-e2e-contract.test.mjs']},
 {id:'six-role-live-qa',name:'Live deployed Main acceptance with distinct QA credentials for six roles',
  status:'blocked-on-main-qa-credentials',source:[
   '.github/workflows/fast-change-validation.yml',
  ],tests:['tests/main-live-qa-explicit-trigger.test.mjs']},
 {id:'live-external-transactions',name:'End-to-end real EventPay, Weeztix, bank and e-signature deliveries',
  status:'live-provider-acceptance-unverified',source:[
   'docs/MAIN_INTEGRATIONS_2026-11-09.md',
  ],tests:['tests/provider-connection-check.test.mjs']},
 {id:'disaster-recovery',name:'Backup restored to a separate project and verified disaster recovery',
  status:'live-restore-evidence-unverified',source:[
   'docs/RECOVERY_AND_RELEASE_GATE.md',
  ],tests:['tests/production-dry-run-contract.test.mjs']},
]

export function inspectRequirements(root=process.cwd()){
 const failures=[]
 for(const item of requirements){
  for(const file of [...item.source,...item.tests]){
   if(!existsSync(root+'/'+file))failures.push(item.id+' missing '+file)
  }
 }
 const provider=readFileSync(root+'/docs/EVENTPAY_CASHLESS_BAR_MERCH_TOKENS.md','utf8')
 if(!provider.includes('geen werkende live-betaalkoppeling')){
  failures.push('EventPay completion state changed: manually review checkout provider evidence before approving')
 }
 const bots=readFileSync(root+'/scripts/seed-15-bot-users.mjs','utf8')
 if(!bots.includes("...Array(13).fill('staff')")){
  failures.push('The stress-bot role composition changed: re-audit seven-role bot coverage')
 }
 const workflows=readdirSync(root+'/.github/workflows').filter(x=>/\.ya?ml$/.test(x))
 if(workflows.length!==5)failures.push('Expected exactly five approved GitHub workflows')
 return {
  verifiedAt:'source audit (no live external calls)',
  scope:'Main codebase, not deployed provider acceptance',
  sourceAndTestEvidence:requirements.filter(x=>x.status.startsWith('code-and-isolated-tests')).length,
  blockedOrUnverified:requirements.filter(x=>!x.status.startsWith('code-and-isolated-tests')).length,
  requirements:requirements.map(({id,name,status})=>({id,name,status})),
  missingEvidence:failures,
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=inspectRequirements()
 console.log('Main requirements source inventory: '+JSON.stringify({
  total:result.requirements.length,
  codeAndTests:result.sourceAndTestEvidence,
  blockedOrUnverified:result.blockedOrUnverified,
  missingEvidence:result.missingEvidence.length,
 }))
 for(const item of result.requirements.filter(x=>!x.status.startsWith('code-and-isolated-tests')))
  console.log('NOT COMPLETE:',item.id,'—',item.status)
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\n### Main requirements inventory (not a release certificate)\n'+
  '- Requirements inventoried: '+result.requirements.length+'\n'+
  '- Code + test evidence identified: '+result.sourceAndTestEvidence+'\n'+
  '- External/QA readiness open: '+result.blockedOrUnverified+'\n'+
  '- Missing required source/test files: '+result.missingEvidence.length+'\n'+
  '- EventPay in-app checkout is not implemented; do not claim A–Z completion.\n')
 if(result.missingEvidence.length){
  for(const error of result.missingEvidence)console.error('MISSING SOURCE EVIDENCE:',error)
  process.exitCode=1
 }
}
