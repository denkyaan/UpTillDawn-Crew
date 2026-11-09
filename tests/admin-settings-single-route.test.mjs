import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const settings=readFileSync('app/(app)/settings/page.tsx','utf8')

test('admin settings contain only unique administration targets',()=>{
  for(const href of ['/operations','/events','/workplaces','/personnel','/crew']){
    assert.ok(!settings.includes(`<AdminCard href="${href}`),`Duplicate settings shortcut: ${href}`)
  }
  assert.match(settings,/href="\/admin\/platform#automatiseringen"/)
  assert.match(settings,/href="\/audit"/)
  assert.match(settings,/isOwner===true&&<AdminCard href="\/god-mode\/login"/)
})

test('core settings for language profile and device notifications stay available',()=>{
  assert.match(settings,/<ProfileForm/)
  assert.match(settings,/<PushNotificationSettings/)
  assert.match(settings,/<LanguageSwitcher/)
  assert.match(settings,/s\.rpc\('upt_own_profile_details'\)/)
})
