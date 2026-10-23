import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('the migrated approval gate uses the exact mandatory fields visible for each role',async()=>{
  const [migration,profile]=await Promise.all([
    read('supabase/migrations/20261009124500_first_profile_role_requirements.sql'),
    read('components/crew/profile-form.tsx'),
  ])
  assert.match(migration,/if p\.role <> 'admin'/)
  for(const column of ['full_name','phone_number','date_of_birth','profile_photo_url']){
    assert.ok(migration.includes('p.'+column),'missing mandatory field for all roles: '+column)
  }
  for(const column of ['home_address','national_register_number','iban']){
    assert.ok(migration.indexOf('p.'+column)>migration.indexOf("if p.role <> 'admin'"),'extra crew-only mandatory field leaked to admin: '+column)
  }
  assert.match(migration,/where id = auth\.uid\(\)/)
  assert.match(migration,/revoke all on function public\.upt_mark_own_profile_complete\(\) from public, anon/)
  assert.match(migration,/grant execute on function public\.upt_mark_own_profile_complete\(\) to authenticated/)
  assert.match(profile,/\{!isAdminProfile&&/)
  assert.match(profile,/upt_mark_own_profile_complete/)
})

test('tour is never rendered while mandatory completion is unresolved',async()=>{
  const tour=await read('components/role-app-tour.tsx')
  assert.match(tour,/profileGate,setProfileGate/)
  assert.match(tour,/if\(!state\)\{setProfileGate\("blocked"\)/)
  assert.match(tour,/if\(state.required&&!state.completed\)/)
  assert.match(tour,/<TourControlCenter active=\{open&&profileGate==="ready"\}/)
  assert.match(tour,/sessionStorage\.removeItem\(TOUR_SESSION_KEY\)/)
})
