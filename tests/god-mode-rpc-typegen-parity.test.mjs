import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('God Mode Maker log RPC matches the generated PostgreSQL function order',async()=>{
 const text=await readFile(new URL('../types/crew-database.ts',import.meta.url),'utf8')
 const marker="upt_god_maker_log_snapshot: {\n        Args: { p_limit?: number; p_token: string }"
 assert.ok(text.includes(marker))
 assert.equal(text.split('upt_god_maker_log_snapshot:').length,2)
 assert.ok(text.indexOf('upt_god_logout:')<text.indexOf('upt_god_maker_log_snapshot:'))
 assert.ok(text.indexOf('upt_god_maker_log_snapshot:')<text.indexOf('upt_god_repository_connect:'))
})
