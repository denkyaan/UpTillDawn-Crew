import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('admin first-use state guides a clean production into the first real event',async()=>{
  const [admin,events,component]=await Promise.all([
    read('app/(app)/admin/page.tsx'),
    read('app/(app)/events/page.tsx'),
    read('components/admin/first-use-readiness.tsx'),
  ])
  assert.match(admin,/!eventRows\.length&&<FirstUseReadiness/)
  assert.match(events,/id="event-aanmaken"/)
  assert.match(component,/\/events#event-aanmaken/)
  assert.match(component,/\/personnel/)
  assert.match(component,/\/workplaces/)
  assert.match(component,/\/briefings/)
  assert.match(component,/\/help/)
  for(const locale of ['nl','fr','en','de'])assert.match(component,new RegExp('\\n  '+locale+':\\{'))
})

test('first-use account flow keeps profile completion tour and PWA installation gates',async()=>{
  const [signup,tour,prompt]=await Promise.all([
    read('app/(auth)/signup/page.tsx'),
    read('components/role-app-tour.tsx'),
    read('components/first-use-install-prompt.tsx'),
  ])
  assert.match(signup,/queuePwaInstallPrompt\(\)/)
  assert.match(tour,/upt_current_profile_completion/)
  assert.match(tour,/\/settings\?complete-profile=1/)
  assert.match(tour,/uptilldawn-profile-completed/)
  assert.match(prompt,/PWA_INSTALL_PROMPT_PENDING_KEY/)
})

test('first event receives the full standard workplace baseline',async()=>{
  const [master,tokens,driver]=await Promise.all([
    read('supabase/migrations/20260928205500_workplace_master_seed_and_alert_kind_fix.sql'),
    read('supabase/migrations/20261003221500_add_tokens_standard_workplace.sql'),
    read('supabase/migrations/20261005123000_driver_workplace_transport_tasks.sql'),
  ])
  for(const name of ['Inkom & Guestlist','Merch','Bar/Toog','Backstage Management','Allrounder','Opbouw','Afbouw'])assert.ok(master.includes(name),name)
  assert.match(tokens,/['"]Tokens['"]/)
  assert.match(driver,/['"]Driver['"]/)
  assert.match(master,/create or replace function public\.upt_seed_event/)
})
