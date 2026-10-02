import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('personnel management keeps approval role block delete and self-lockout controls',async()=>{
 const [approval,crew,actions,button]=await Promise.all([
  read('app/(app)/personnel/page.tsx'),read('app/(app)/crew/page.tsx'),
  read('lib/actions/personnel.ts'),read('components/admin/personnel-delete-button.tsx'),
 ])
 assert.match(approval,/approvePersonnelAccount/)
 assert.match(approval,/responsible_lead/)
 assert.match(crew,/setPersonnelRole/)
 assert.match(crew,/setPersonnelBlock/)
 assert.match(crew,/PersonnelDeleteButton/)
 assert.match(actions,/target===user\.id/)
 assert.match(actions,/humanizeAppError\(error\)/)
 assert.match(button,/Typ de volledige naam om te bevestigen/)
 assert.match(button,/disabled=!\{?matches\}?|disabled=\{!matches\}/)
})

test('database guards keep Maker undeletable unblockable and approved',async()=>{
 const [blockGuard,deleteGuard,god]=await Promise.all([
  read('supabase/migrations/20260928084057_pre_event_inventory_personnel_platform_fixes.sql'),
  read('supabase/migrations/20260928084916_personnel_delete_block_guard.sql'),
  read('supabase/migrations/20260927192717_maker_god_mode_entry.sql'),
 ])
 assert.match(blockGuard,/is_app_owner\(p_user\).*maker van de app kan niet worden geblokkeerd/is)
 assert.match(deleteGuard,/is_app_owner\(p_user\).*app-eigenaar kan niet.*worden verwijderd/is)
 assert.match(deleteGuard,/approved=case when upt_private\.is_app_owner\(p_user\) then true/)
 assert.match(god,/not upt_private\.is_app_owner\(auth\.uid\(\)\)/)
})

test('role transitions explicitly retain Staff Responsible and Admin',async()=>{
 const actions=await read('lib/actions/personnel.ts')
 assert.match(actions,/z\.enum\(\['admin','responsible_lead','staff'\]\)/)
 const crew=await read('app/(app)/crew/page.tsx')
 assert.match(crew,/<option value="staff">Personeel<\/option>/)
 assert.match(crew,/<option value="responsible_lead">Verantwoordelijke<\/option>/)
 assert.match(crew,/<option value="admin">Beheerder<\/option>/)
})
