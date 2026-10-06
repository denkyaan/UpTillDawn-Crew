import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  canAccessEventDocument,
  shouldCacheDocumentOffline,
} from '../lib/document-access.ts'

test('document access foundation preserves audience hierarchy and offline flag', () => {
  assert.equal(canAccessEventDocument('employee',{audiences:['employee']}),true)
  assert.equal(canAccessEventDocument('employee',{audiences:['responsible']}),false)
  assert.equal(canAccessEventDocument('responsible',{audiences:['responsible']}),true)
  assert.equal(canAccessEventDocument('admin',{audiences:['responsible']}),true)
  assert.equal(shouldCacheDocumentOffline({audiences:['employee'],offlineCritical:true}),true)
  assert.equal(shouldCacheDocumentOffline({audiences:['employee']}),false)
})

test('event documents use isolated metadata RLS and RPC-only mutation', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927114253_event_document_library.sql',import.meta.url),'utf8')
  assert.match(source,/create table if not exists public\.event_documents/)
  assert.match(source,/alter table public\.event_documents enable row level security/)
  assert.match(source,/revoke all on table public\.event_documents from anon/)
  assert.match(source,/revoke insert,update,delete on table public\.event_documents from authenticated/)
  assert.match(source,/grant select on table public\.event_documents to authenticated/)
  assert.match(source,/upt_work_media_event_document_read/)
  assert.match(source,/upt_private\.document_can_view/)
})

test('workplace documents require a workplace-specific shift or responsible assignment', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927114350_event_document_scope_hardening.sql',import.meta.url),'utf8')
  assert.match(source,/if p_workplace is null and exists\([\s\S]*?from public\.event_members/)
  assert.match(source,/s\.workplace_id=p_workplace/)
  assert.match(source,/ra\.workplace_id=p_workplace/)
  assert.match(source,/s\.status<>'cancelled'/)
  assert.match(source,/s\.response_status<>'declined'/)
})

test('responsible can manage only workplace-scoped documents while admin can manage event-wide', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927114253_event_document_library.sql',import.meta.url),'utf8')
  assert.match(source,/public\.upt_is_admin/)
  assert.match(source,/p_workplace is not null/)
  assert.match(source,/public\.upt_is_responsible/)
  assert.match(source,/Geen toegang tot documentbeheer/)
})

test('document upload verifies storage presence and safe user-owned path', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927114253_event_document_library.sql',import.meta.url),'utf8')
  assert.match(source,/split_part\(p_storage_path,'\/',1\)<>v_actor::text/)
  assert.match(source,/split_part\(p_storage_path,'\/',2\)<>'document'/)
  assert.match(source,/from storage\.objects/)
  assert.match(source,/bucket_id='work-media'/)
})

test('document notifications respect audience rank after scope hardening', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927114350_event_document_scope_hardening.sql',import.meta.url),'utf8')
  assert.match(source,/target\.role_rank >= upt_private\.document_role_rank\(p_audience\)/)
  assert.match(source,/Nieuw belangrijk document/)
  assert.match(source,/event_document\.created/)
})

test('event document UI is integrated in Events without a new navigation tab', async () => {
  const [events,panel,roles,nav,actions]=await Promise.all([
    readFile(new URL('../app/(app)/events/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/event-documents-panel.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/role-ui.ts',import.meta.url),'utf8'),
    readFile(new URL('../components/layout/navigation-items.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/uptilldawn.ts',import.meta.url),'utf8'),
  ])
  assert.match(events,/EventDocumentsPanel/)
  assert.match(events,/canManageDocuments/)
  assert.match(panel,/OFFLINE BELANGRIJK/)
  assert.match(panel,/Alle toegewezen crew/)
  assert.match(panel,/Responsible \+ Admin/)
  assert.match(panel,/Hele evenement/)
  assert.match(roles,/featureRule\("admin","documents","Documenten",118\)/)
  assert.match(roles,/featureRule\("responsible_lead","documents","Documenten",118\)/)
  assert.match(roles,/featureRule\("staff","documents","Documenten",118\)/)
  assert.doesNotMatch(nav,/key:"documents"/)
  assert.match(actions,/function createEventDocument/)
  assert.match(actions,/function archiveEventDocument/)
})

test('critical documents are stored per user offline and cleared on logout', async () => {
  const [snapshot,sync,offline,sw]=await Promise.all([
    readFile(new URL('../lib/crew-offline-snapshot.ts',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/global-offline-content-sync.tsx',import.meta.url),'utf8'),
    readFile(new URL('../public/offline-content.js',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8'),
  ])
  assert.match(snapshot,/OfflineDocument/)
  assert.match(snapshot,/indexedDB\.open\('uptilldawn-offline-content',2\)/)
  assert.match(sync,/key:userId\+'\:'\+row\.id/)
  assert.match(snapshot,/tx=content\.transaction\(\['content','documents'\],'readwrite'\)/)
  assert.match(sync,/event_documents/)
  assert.match(sync,/offline_critical/)
  assert.match(sync,/storage\.from\('work-media'\)\.download/)
  assert.match(sync,/replaceOfflineDocuments/)
  assert.match(offline,/Documenten offline/)
  assert.match(offline,/OPEN OFFLINE BESTAND/)
  assert.match(sw,/uptilldawn-public-v12/)
})
