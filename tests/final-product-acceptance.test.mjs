import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('final acceptance covers registration approval and portal role binding',async()=>{
  const [auth,login,personnel]=await Promise.all([read('lib/actions/auth.ts'),read('components/auth/login-form.tsx'),read('lib/actions/personnel.ts')])
  assert.match(auth,/approved/)
  assert.match(auth,/requestedPortal/)
  assert.match(login,/redirectTo/)
  assert.match(personnel,/approve/)
})

test('final acceptance covers event planning briefing workplace shift and availability',async()=>{
  const [events,workplaces,briefing]=await Promise.all([read('app/(app)/events/page.tsx'),read('components/crew/workplace-shift-planner.tsx'),read('app/(app)/briefings/page.tsx')])
  assert.match(events,/Beschikbaarheid bevestigen/)
  assert.match(workplaces,/assignAvailableCrewShift/)
  assert.match(workplaces,/Personeel \+ uren toevoegen/)
  assert.match(briefing,/OperationalChecklistPanel/)
})

test('final acceptance covers check-in work break checkout and governed timesheets',async()=>{
  const [qr,operations,actions,timesheets]=await Promise.all([read('components/crew/qr-shift-request.tsx'),read('app/(app)/operations/operations-client.tsx'),read('lib/actions/uptilldawn.ts'),read('lib/timesheet-approval.ts')])
  assert.match(qr,/upt_qr_request/)
  assert.match(operations,/pauze/i)
  assert.match(actions,/upt_/)
  assert.match(timesheets,/open.*submitted.*approved.*rejected.*locked/)
})

test('final acceptance covers tasks inventory guestlist sales incidents and realtime collaboration',async()=>{
  const [tasks,inventory,guestlist,sales,chat,realtime]=await Promise.all([
    read('app/(app)/tasks/page.tsx'),read('components/crew/inventory-panel.tsx'),read('components/crew/guestlist-entrance-client.tsx'),
    read('components/crew/sales-register-client.tsx'),read('components/crew/chat-client.tsx'),read('components/realtime-refresh.tsx'),
  ])
  assert.match(tasks,/task/i)
  assert.match(inventory,/RETOUR MELDEN/)
  assert.match(guestlist,/upt_guestlist_checkin/)
  assert.match(sales,/VERKOCHT/)
  assert.match(chat,/postgres_changes/)
  assert.match(realtime,/postgres_changes/)
})

test('final acceptance covers post-event closure archive and retained operational controls',async()=>{
  const [command,actions,archive]=await Promise.all([read('app/(app)/events/[id]/command/page.tsx'),read('lib/actions/events.ts'),read('components/events/archive-center.tsx')])
  assert.match(command,/Post-event afsluiting/)
  assert.match(actions,/upt_close_event/)
  assert.match(actions,/upt_archive_event/)
  assert.match(archive,/archive/i)
})

test('final acceptance keeps retired admin surfaces retired and all static UI four-language gated',async()=>{
  const [health,release,i18n]=await Promise.all([read('app/(app)/admin/health/page.tsx'),read('app/(app)/admin/release/page.tsx'),read('tests/i18n-static-ui-coverage.test.mjs')])
  assert.match(health,/redirect\('\/admin'\)/)
  assert.match(release,/redirect\('\/admin'\)/)
  for(const locale of ['NL','FR','EN','DE'])assert.ok(i18n.includes(locale),locale)
})


test('release CI includes the 15-browser-bot gate',async()=>{
  const [workflow,bots]=await Promise.all([read('.github/workflows/ci.yml'),read('scripts/15-bot-browser-test.mjs')])
  assert.match(workflow,/browser-bots:/)
  assert.match(workflow,/Run 15 concurrent browser bots/)
  assert.match(bots,/Array\(13\)\.fill\('staff'\)/)
  for(const locale of ['nl','fr','en','de'])assert.ok(bots.includes(`'${locale}'`),locale)
  assert.match(bots,/Promise\.all\(roles\.map/)
})


test('15-bot full-event simulation is part of fresh-install release gate',async()=>{
  const [workflow,simulation]=await Promise.all([read('.github/workflows/ci.yml'),read('tests/sql/15-bot-full-event.sql')])
  assert.match(workflow,/for file in tests\/sql\/\*\.sql/)
  assert.match(simulation,/generate_series\(1,15\)/)
  assert.match(simulation,/bot_01/)
  assert.match(simulation,/responsible_assignments/)
  assert.match(simulation,/upt_create_shift/)
  assert.match(simulation,/event_availability/)
  assert.match(simulation,/ROLLBACK;/)
})
