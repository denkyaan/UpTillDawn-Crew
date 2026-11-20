import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {inspectRequirements,requirements} from '../scripts/main-requirements-audit.mjs'

test('all promised feature areas have concrete code and test source evidence or are explicitly incomplete',()=>{
 const audit=inspectRequirements()
 assert.ok(audit.requirements.length>=20)
 assert.deepEqual(audit.missingEvidence,[])
 for(const item of requirements){
  assert.ok(item.source.length,'No implementation/documentation evidence for '+item.id)
  assert.ok(item.tests.length,'No test evidence for '+item.id)
 }
 const ids=new Set(requirements.map(x=>x.id))
 assert.equal(ids.size,requirements.length)
})

test('do not misrepresent EventPay statement import as real RFID/QR checkout',()=>{
 const result=inspectRequirements()
 const state=result.requirements.find(item=>item.id==='eventpay-checkout')
 assert.equal(state?.status,'not-implemented-external-provider-spec-needed')
 const source=readFileSync('docs/EVENTPAY_CASHLESS_BAR_MERCH_TOKENS.md','utf8')
 assert.match(source,/geen werkende live-betaalkoppeling/)
 assert.match(source,/geen extra eigen cashless-wallet/i)
 const sql=readFileSync('supabase/migrations/20261112062000_eventpay_readonly_statement_reconciliation.sql','utf8')
 assert.match(sql,/import-only integration/)
 assert.match(sql,/does NOT configure payment credentials or enable any checkout/i)
})

test('seven distinct persistent role bots and live 6-role sessions are not certified by source-only fixtures',()=>{
 const audit=inspectRequirements()
 assert.equal(audit.requirements.find(x=>x.id==='seven-role-bots')?.status,'not-demonstrated-by-existing-fixtures')
 assert.equal(audit.requirements.find(x=>x.id==='six-role-live-qa')?.status,'blocked-on-main-qa-credentials')
 const stress=readFileSync('scripts/seed-15-bot-users.mjs','utf8')
 assert.match(stress,/const roles = \['admin', 'responsible', \.\.\.Array\(13\)\.fill\('staff'\)\]/)
 const six=readFileSync('scripts/e2e-all-portals.mjs','utf8')
 assert.match(six,/administration/i)
 assert.match(six,/promotion/i)
 assert.match(six,/maker/i)
})

test('release acceptance is never inferred from source existence or a green unit test',()=>{
 const doc=readFileSync('docs/REQUIREMENTS_DELIVERY_AUDIT_20261112.md','utf8')
 assert.match(doc,/niet bewezen|not verified|niet bevestigd/i)
 assert.match(doc,/EventPay/)
 assert.match(doc,/Cloudflare/)
 assert.match(doc,/PR #289/)
 assert.match(doc,/76/)
 const workflow=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
 assert.match(workflow,/node scripts\/main-requirements-audit\.mjs/)
 assert.doesNotMatch(workflow,/run seven role bots authenticated main test automatically on every push/)
})
