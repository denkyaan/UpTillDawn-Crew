import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')

test('subtab actions are unique and do not repeat generic links or footer buttons',()=>{
 assert.doesNotMatch(source,/administrationWorkflowHref\(slug\)&&<div/)
 assert.doesNotMatch(source,/operationalModuleLabels/)
 assert.doesNotMatch(source,/\(slug==="invoices"\|\|slug==="banking"\)&&<section className="rounded-2xl border border-violet-500/)
 assert.doesNotMatch(source,/\{financeRelated\.has\(slug\)&&<section className="rounded-2xl border bg-card p-5">\s*<h2 className="font-semibold">\{u\.related/)
 assert.doesNotMatch(source,/\{u\.pending\}/)
 assert.match(source,/administrationWorkspaceIntro\[slug\]/)
 assert.match(source,/<SepaExport locale=\{locale\}/)
 assert.match(source,/<BankStatementWorkspace locale=\{locale\}/)
 assert.match(source,/<ProviderBankSettlementWorkspace locale=\{locale\}/)
})

test('marketing instructions keep users in administration',()=>{
 assert.match(source,/Beheer promotietaken binnen Administratie/)
 assert.doesNotMatch(source,/Beheer promotietaken via het promotieportaal/)
})
