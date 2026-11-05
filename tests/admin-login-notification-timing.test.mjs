import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/api/auth/admin-login/route.ts','utf8')
test('security notification timing is reported for successful and unsuccessful admin logins',()=>{
 assert.match(source,/\[admin-login\] security notification timing/)
 for(const phase of ['failure_notification','denied_notification','role_mode_notification','success_notification'])assert.ok(source.includes(`enterPhase('${phase}')`))
 assert.match(source,/durationMs: Date\.now\(\) - notificationStartedAt/)
 assert.match(source,/delivered/)
 const payload=source.match(/console\.info\('\[admin-login\] security notification timing',\s*\{([^}]*)\}/)?.[1]||''
 assert.doesNotMatch(payload,/password|email|login|ip\b|userAgent/i)
})
