import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const finance=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('Empty finance ledger skips unnecessary document-related RLS queries without losing summary and new-document workflows',()=>{
 assert.match(finance,/const ledgerSummary=await .*\.rpc\('upt_administration_finance_summary'\)/)
 assert.match(finance,/if\(ledgerSummary\.error\|\|!ledgerSummary\.data\)throw new Error/)
 assert.match(finance,/const noFinancialDocuments=Number\(ledgerSummary\.data\.documents\)===0/)
 assert.equal((finance.match(/noFinancialDocuments\?Promise\.resolve\(\{data:\[\],error:null\}\)/g)||[]).length,5)
 assert.match(finance,/noFinancialDocuments\?\{data:\[\],error:null\}:await .*\.rpc\('upt_administration_document_balances'/)
 assert.match(finance,/from\('admin_counterparties'\)\.select/)
 assert.match(finance,/from\('events'\)\.select/)
 assert.match(finance,/return <main className="mx-auto max-w-5xl/)
 for(const action of ['createDraft','createCounterparty','updateCounterparty','recordFinancialPayment','createPaymentReminder','uploadFinancialAttachment'])
  assert.ok(finance.includes('action={'+action+'}'),action+' workflow lost')
 assert.match(finance,/currentPortalAssignments\(\)/)
 assert.match(finance,/!canOpenPortal\('administration'/)
})
