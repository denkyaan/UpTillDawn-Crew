import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const sql=readFileSync(new URL("../supabase/migrations/20261026233000_signing_ledger_block_client_forgery.sql",import.meta.url),"utf8")
test("browser users cannot forge signed contract status or PDF paths",()=>{
 assert.match(sql,/drop policy if exists administration_signing_artist_update/)
 assert.match(sql,/revoke update on table public\.administration_contract_signing_requests/)
 assert.match(sql,/from authenticated, anon/)
 assert.match(sql,/revoke update \(envelope_id,status,updated_at,dispatched_at,completed_at,signed_pdf_path\)/)
 assert.doesNotMatch(sql,/grant update/i)
})
