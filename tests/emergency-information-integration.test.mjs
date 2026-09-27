import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  emergencyCacheKey,
  emergencyInformationIsUsable,
} from '../lib/emergency-mode.ts'

test('emergency foundation requires event name address and emergency number', () => {
  assert.equal(emergencyInformationIsUsable({
    eventName:'Festival',
    eventAddress:'Mainstraat 1',
    emergencyNumber:'112',
    updatedAt:1,
  }),true)
  assert.equal(emergencyInformationIsUsable({
    eventName:'Festival',
    eventAddress:'',
    emergencyNumber:'112',
    updatedAt:1,
  }),false)
  assert.equal(emergencyCacheKey('event-1'),'uptilldawn:emergency:event-1')
})

test('emergency information table is RLS protected and browser mutation is RPC only', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927112534_event_emergency_information.sql',import.meta.url),'utf8')
  assert.match(source,/create table if not exists public\.event_emergency_information/)
  assert.match(source,/alter table public\.event_emergency_information enable row level security/)
  assert.match(source,/revoke all on table public\.event_emergency_information from anon/)
  assert.match(source,/revoke insert,update,delete on table public\.event_emergency_information from authenticated/)
  assert.match(source,/grant select on table public\.event_emergency_information to authenticated/)
  assert.match(source,/upt_feature_allowed\('emergency'/)
})

test('emergency read scope accepts membership shift or responsible assignment', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927112534_event_emergency_information.sql',import.meta.url),'utf8')
  assert.match(source,/from public\.event_members/)
  assert.match(source,/from public\.shifts/)
  assert.match(source,/from public\.responsible_assignments/)
  assert.match(source,/s\.status<>'cancelled'/)
  assert.match(source,/s\.response_status<>'declined'/)
  assert.match(source,/now\(\)<=e\.end_at \+ interval '3 days'/)
})

test('only admin can update emergency information and changes are audited and notified', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927112534_event_emergency_information.sql',import.meta.url),'utf8')
  assert.match(source,/if not public\.upt_is_admin\(v_actor\)/)
  assert.match(source,/emergency_information\.updated/)
  assert.match(source,/Noodinformatie bijgewerkt/)
  assert.match(source,/revoke all on function public\.upt_upsert_event_emergency_information/)
  assert.match(source,/grant execute on function public\.upt_upsert_event_emergency_information/)
})

test('emergency role rule defaults are feature controls and not a navigation tab', async () => {
  const [roles,nav,scopeMigration]=await Promise.all([
    readFile(new URL('../lib/role-ui.ts',import.meta.url),'utf8'),
    readFile(new URL('../components/layout/navigation-items.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260927112932_emergency_feature_scope_alignment.sql',import.meta.url),'utf8'),
  ])
  assert.match(roles,/featureRule\("admin","emergency","Noodinformatie",115\)/)
  assert.match(roles,/featureRule\("responsible_lead","emergency","Noodinformatie",115\)/)
  assert.match(roles,/featureRule\("staff","emergency","Noodinformatie",115\)/)
  assert.doesNotMatch(nav,/key:"emergency"/)
  assert.match(scopeMigration,/feature_key='emergency'/)
  assert.match(scopeMigration,/condition_key='always'/)
})

test('emergency information is integrated into event preparation and live help flow', async () => {
  const [events,incidents,panel,actions]=await Promise.all([
    readFile(new URL('../app/(app)/events/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/incidents/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/emergency-information-panel.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/uptilldawn.ts',import.meta.url),'utf8'),
  ])
  assert.match(events,/event_emergency_information/)
  assert.match(events,/EmergencyInformationPanel/)
  assert.match(events,/canEdit=\{user\.isAdmin\}/)
  assert.match(incidents,/event_emergency_information/)
  assert.match(incidents,/EmergencyInformationPanel/)
  for(const label of ['Noodnummer','EHBO','Security','Verzamelpunt','Noodprocedure'])assert.ok(panel.includes(label),label)
  assert.match(actions,/function updateEventEmergencyInformation/)
  assert.match(actions,/upt_upsert_event_emergency_information/)
})

test('emergency information is cached per user and rendered in the private offline shell', async () => {
  const [snapshot,sync,offline,sw]=await Promise.all([
    readFile(new URL('../lib/crew-offline-snapshot.ts',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/global-offline-content-sync.tsx',import.meta.url),'utf8'),
    readFile(new URL('../public/offline-content.js',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8'),
  ])
  assert.match(snapshot,/OfflineEmergencyInfo/)
  assert.match(snapshot,/saveOfflineEmergency/)
  assert.match(sync,/event_emergency_information/)
  assert.match(sync,/saveOfflineEmergency/)
  assert.match(offline,/Noodinformatie offline/)
  assert.match(offline,/Verzamelpunt:/)
  assert.match(sw,/uptilldawn-public-v11/)
})

test('emergency telephone links retain digits and optional leading plus only', async () => {
  const panel=await readFile(new URL('../components/crew/emergency-information-panel.tsx',import.meta.url),'utf8')
  const sanitiserLine=panel.split('\n').find(line=>line.includes('const cleaned=value.replace'))
  assert.equal(sanitiserLine,String.raw`  const cleaned=value.replace(/[^+\d]/g,'')`)
  assert.match(panel,/tel:/)
})
