import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')
const access=read('lib/portal-access-server.ts')
const switcher=read('components/layout/portal-switcher.tsx')
const administration=read('app/(app)/portals/administration/layout.tsx')
const finance=read('app/(app)/portals/administration/finance/page.tsx')
const offline=read('components/crew/global-offline-content-sync.tsx')
const layout=read('components/layout/app-layout.tsx')
const qa=read('scripts/e2e-seven-main-bots.mjs')

test('portal assignment cache is per React request, never cross-user or RLS bypass',()=>{
 assert.match(access,/import \{cache\} from 'react'/)
 assert.match(access,/export const currentPortalAssignments=cache\(async\(\)=>\{/)
 assert.match(access,/await createClient\(\)/)
 assert.match(access,/supabase\.rpc\('upt_my_portal_assignments'\)/)
 assert.doesNotMatch(access,/service_role|serviceRole|adminClient/)
 for(const source of [switcher,administration,finance])
  assert.match(source,/currentPortalAssignments\(\)/)
 assert.match(administration,/!user\.isOwner&&!user\.realIsAdmin/)
 assert.match(administration,/!canOpenPortal\("administration"/)
 assert.match(finance,/!current\.realIsAdmin && !current\.isOwner/)
 assert.match(finance,/!canOpenPortal\('administration'/)
 assert.match(finance,/if\(error\|\|!canOpenPortal/)
})

test('portal chooser skips extra membership query for already verified owner and admin',()=>{
 assert.match(switcher,/current\.isOwner\|\|current\.realIsAdmin/)
 assert.match(switcher,/userVisiblePortals\(error\?\[\]:/)
})

test('offline snapshots are complete but use three-way bounded queue after initial page render',()=>{
 assert.match(offline,/boundedQueries\(\[/)
 assert.match(offline,/\],3\)/)
 assert.match(offline,/const initialSync=window\.setTimeout/)
 assert.match(offline,/window\.clearTimeout\(initialSync\)/)
 for(const name of ['saveOfflineBriefings','saveOfflineTasks','saveOfflineEmergency','saveOfflineBrowseData','saveOfflineOperationalData','saveOfflineKnowledge','saveOfflineGuestlistAndSales','replaceOfflineDocuments'])
  assert.ok(offline.includes(name),name)
 assert.match(offline,/window\.addEventListener\('online',onOnline\)/)
 assert.match(offline,/document\.addEventListener\('visibilitychange',onVisible\)/)
})

test('notification polling avoids concurrent request storms without removing badge/context features',()=>{
 assert.match(layout,/const refreshInFlight=useRef\(false\)/)
 assert.match(layout,/refreshInFlight\.current=true/)
 assert.match(layout,/finally\{refreshInFlight\.current=false\}/)
 assert.match(layout,/document\.visibilityState==='hidden'/)
 assert.match(layout,/\]=await boundedQueries\(\[/)
 assert.match(layout,/\],3\)/)
 assert.match(layout,/pathname\.startsWith\("\/portals\/"\)\?30000:10000/)
 assert.match(layout,/upt_chat_unread_total/)
 assert.match(layout,/crew_notifications/)
})

test('aborted browser navigation requires explicit same-origin server denial, never converts 503 to success',()=>{
 assert.match(qa,/Aborted navigation had no confirmed server redirect/)
 assert.match(qa,/page\.request\.get\(url\(path\),\{/)
 assert.match(qa,/maxRedirects:0/)
 assert.match(qa,/probeStatus>=500/)
 assert.match(qa,/probeStatus\)\)return/)
 assert.match(qa,/target\.origin,new URL\(BASE\)\.origin/)
 assert.match(qa,/QA login session lost/)
 assert.match(qa,/Forbidden route redirected to unexpected destination/)
})
