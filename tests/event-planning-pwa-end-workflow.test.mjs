import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('event planning keeps Facebook import location suggestions and three-day setup breakdown governance',async()=>{
 const [events,fb,address,actions,migration]=await Promise.all([
  read('app/(app)/events/page.tsx'),read('components/events/facebook-event-field.tsx'),
  read('components/crew/address-autocomplete.tsx'),read('lib/actions/uptilldawn.ts'),
  read('supabase/migrations/20260925105232_god_mode_event_import_shift_windows.sql'),
 ])
 assert.match(events,/FacebookEventField/)
 assert.match(fb,/name/)
 assert.match(fb,/address/)
 assert.match(fb,/startAt/)
 assert.match(fb,/endAt/)
 assert.match(fb,/humanizeAppError\(error\)/)
 assert.match(address,/\/api\/geocode\/autocomplete/)
 assert.match(address,/role="combobox"/)
 assert.match(address,/humanizeAppError\(fetchError\)/)
 assert.match(actions,/shiftKind=z\.enum\(\['event','setup','breakdown'\]\)/)
 assert.match(migration,/v_event_start-interval '3 days'/)
 assert.match(migration,/v_event_end\+interval '3 days'/)
})

test('workplace and shift planning remains one integrated operational surface',async()=>{
 const [workplaces,planner,legacy]=await Promise.all([
  read('app/(app)/workplaces/page.tsx'),read('components/crew/workplace-shift-planner.tsx'),read('app/(app)/shifts/page.tsx')
 ])
 assert.match(workplaces,/WorkplaceShiftPlanner/)
 assert.match(planner,/assignAvailableCrewShift/)
 assert.match(planner,/shift_kind/)
 assert.match(planner,/overlap_allowed/)
 assert.match(legacy,/redirect\('\/workplaces'\)/)
})

test('installed PWA preserves safe background refresh and opt-in push behavior',async()=>{
 const [register,prompt,sw]=await Promise.all([
  read('components/pwa-register.tsx'),read('components/push-permission-prompt.tsx'),read('public/sw.js')
 ])
 assert.match(register,/periodicSync/)
 assert.match(register,/registration\.update\(\)/)
 assert.match(register,/enablePushNotifications\(\{requestPermission:false\}\)/)
 assert.match(register,/hasPendingCrewData/)
 assert.match(prompt,/requestPermission:true/)
 assert.match(prompt,/isInstalledPwa\(\)/)
 assert.match(sw,/pushsubscriptionchange/)
 assert.match(sw,/notificationclick/)
})
