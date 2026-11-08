import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {safeNotificationPath} from '../lib/portal-access.ts'
test('notification links reject unsafe redirect and traversal attempts',()=>{
 for(const value of ['//attacker.test','/\\attacker.test','/%2e%2e/admin','/a\nb','https://attacker.test'])
  assert.equal(safeNotificationPath(value),'/notifications')
 assert.equal(safeNotificationPath('/portals/administration?tab=finance'),'/portals/administration?tab=finance')
})
test('notification feed separates internal diagnostics from staff alerts',async()=>{
 const source=await readFile(new URL('../app/(app)/notifications/page.tsx',import.meta.url),'utf8')
 assert.match(source,/\.neq\('kind', 'error_report'\)/)
 assert.match(source,/safeNotificationPath\(value\)/)
})
