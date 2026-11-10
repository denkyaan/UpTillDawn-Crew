import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {productionUpgrade} from '../scripts/build-production-upgrade.mjs'

test('non-owner Maker and God Mode requests fail closed before server component rendering',()=>{
 const source=readFileSync('lib/supabase/middleware.ts','utf8')
 assert.match(source,/const makerRoute = pathname === '\/maker-mode'/)
 assert.match(source,/pathname === '\/god-mode' \|\| pathname\.startsWith\('\/god-mode\/'\)/)
 assert.match(source,/if \(user && makerRoute\) \{[\s\S]*?rpc\('upt_current_is_owner'\)/)
 assert.match(source,/if \(ownerError \|\| isOwner !== true\) \{[\s\S]*?url\.pathname = '\/unauthorized'/)
 assert.match(source,/supabaseResponse\.cookies\.getAll\(\)\.forEach\(cookie => response\.cookies\.set\(cookie\)\)/)
})

test('assigned responsible leads can open operations without a personal shift',()=>{
 const source=readFileSync('app/(app)/operations/page.tsx','utf8')
 assert.match(source,/const hasResponsibleAssignment=isResponsible&&responsibleEventRows\.length>0/)
 assert.match(source,/!personalWork&&!hasResponsibleAssignment&&!current\.isEditMode\)redirect\('\/events'\)/)
})

test('historical production platform replay only tolerates the audited out-of-band Maker log migration',()=>{
 const {sql}=productionUpgrade()
 assert.match(sql,/where version<='20261007035500'/)
 assert.match(sql,/version>'20261007035500'/)
 assert.match(sql,/version<>'20261110132255' or name<>'maker_read_only_log_snapshot'/)
 assert.match(sql,/Unexpected post-baseline migration; reconcile before upgrade/)
 assert.match(sql,/to_regprocedure\('public\.upt_god_maker_log_snapshot\(text,integer\)'\)/)
 assert.match(sql,/Audited Maker log migration history has no matching function/)
 assert.match(sql,/Production column contract changed/)
})
