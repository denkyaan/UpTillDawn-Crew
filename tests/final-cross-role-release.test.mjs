import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('setup and teardown assignments remain visible around the event boundary',async()=>{
 const [dashboard,workplaces]=await Promise.all([read('app/(app)/page.tsx'),read('app/(app)/workplaces/page.tsx')])
 assert.match(dashboard,/Date\.parse\(shift\.scheduled_end\)>=nowMs/)
 assert.match(dashboard,/end\+3\*24\*60\*60\*1000/)
 assert.match(workplaces,/futureShiftEventIds/)
 assert.match(workplaces,/responsibleEventIds/)
})

test('background push stores and uses NL FR EN DE subscription locale',async()=>{
 const [migration,client,route,edge,catalog]=await Promise.all([
  read('supabase/migrations/20260930235900_push_subscription_locale.sql'),read('lib/push-client.ts'),read('app/api/push/subscription/route.ts'),
  read('supabase/functions/push-notification/index.ts'),read('supabase/functions/push-notification/i18n.ts')
 ])
 assert.match(migration,/locale in \('nl','fr','en','de'\)/)
 assert.match(client,/activeUiLocale\(\)/)
 assert.match(route,/p_locale:parseUiLocale/)
 assert.match(edge,/payloadFor\(sub\.locale/)
 for(const locale of ['fr:','en:','de:'])assert.ok(catalog.includes(locale),locale)
})

test('God-only automation boundary remains enforced',async()=>{
 const sql=await read('supabase/migrations/20260930231500_god_only_automation_configuration.sql')
 assert.match(sql,/not public\.upt_current_is_owner\(\)/)
 assert.match(sql,/automation_rules_owner_select/)
})
