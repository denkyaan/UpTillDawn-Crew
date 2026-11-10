import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const auth=readFileSync('lib/actions/auth.ts','utf8')
test('Admin login audit preserves the Supabase client receiver',()=>{
 assert.match(auth,/const rpc = supabase\.rpc\.bind\(supabase\) as unknown as/)
 assert.match(auth,/return rpc\(fn, args\)/)
 assert.doesNotMatch(auth,/const rpc = supabase\.rpc as unknown/)
})
