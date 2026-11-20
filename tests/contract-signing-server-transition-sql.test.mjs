import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const sql=readFileSync(new URL("../supabase/migrations/20261027090000_server_signing_transition_cas.sql",import.meta.url),"utf8")
test("signing transition requires service role and is not browser callable",()=>{
 assert.match(sql,/security invoker/i)
 assert.match(sql,/current_user <> 'service_role'/)
 assert.match(sql,/revoke all on function[\s\S]+from public, anon, authenticated/i)
 assert.match(sql,/grant execute on function[\s\S]+to service_role/i)
})
test("signing transitions are conditional and signed archives immutable",()=>{
 assert.match(sql,/status = p_expected_status/)
 assert.match(sql,/signed_pdf_path is null/)
 assert.match(sql,/get diagnostics v_changed = row_count/i)
 assert.match(sql,/p_expected_status = 'draft'/)
 assert.match(sql,/p_expected_status = 'sent'/)
})
