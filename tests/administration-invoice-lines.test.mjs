import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const finance=readFileSync("app/(app)/portals/administration/finance/page.tsx","utf8")
const sql=readFileSync("supabase/migrations/20261027170000_administration_invoice_line_totals.sql","utf8")

test("administration invoice line entry requires draft document and displays line items",()=>{
 assert.match(finance,/async function addInvoiceLine\(/)
 assert.match(finance,/document\.status!=='draft'/)
 assert.match(finance,/from\('admin_financial_lines'\)\.insert/)
 assert.match(finance,/from\('admin_financial_lines'\)\.select/)
 assert.match(finance,/action=\{addInvoiceLine\}/)
 assert.match(finance,/d\.status==='draft'/)
})
test("line totals are recomputed server-side and header overrides are blocked",()=>{
 assert.match(sql,/after insert or update or delete on public\.admin_financial_lines/i)
 assert.match(sql,/round\(sum\(quantity \* unit_price\),2\)/)
 assert.match(sql,/round\(sum\(round\(quantity \* unit_price \* vat_rate \/ 100,2\)\),2\)/)
 assert.match(sql,/where id=target_id and status='draft'/)
 assert.match(sql,/pg_trigger_depth\(\) <= 1/)
 assert.match(sql,/revoke execute on function public\.upt_admin_recalculate_financial_lines\(\)/)
})
