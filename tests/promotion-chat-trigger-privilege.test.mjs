import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

test("promotion chat reply trigger is not directly callable by browser roles",()=>{
 const migration=readFileSync(new URL("../supabase/migrations/20261109224939_revoke_promotion_chat_reply_trigger_direct_execute.sql",import.meta.url),"utf8")
 const privilege=readFileSync(new URL("./sql/privilege-matrix.sql",import.meta.url),"utf8")
 assert.match(migration,/revoke all on function public\.upt_validate_promotion_chat_reply\(\)/)
 assert.match(migration,/from public, anon, authenticated/)
 assert.match(privilege,/has_function_privilege\('public',p\.oid,'EXECUTE'\)/)
 assert.match(privilege,/has_function_privilege\('anon',p\.oid,'EXECUTE'\)/)
 assert.match(privilege,/has_function_privilege\('authenticated',p\.oid,'EXECUTE'\)/)
})
