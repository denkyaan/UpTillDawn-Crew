import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('admin profile policy and birthday automation stay wired together', async () => {
  const [profile,settings,chat,runtime,push,migration,personalizedMigration]=await Promise.all([
    readFile(new URL('../components/crew/profile-form.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/settings/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/chat-client.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-runtime.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/functions/push-notification/i18n.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006113000_admin_profile_birthday_greetings.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006114500_personalized_birthday_chat.sql',import.meta.url),'utf8'),
  ])

  assert.ok(settings.includes("isAdminProfile={current?.realRole==='admin'}"))
  assert.ok(profile.includes("!isAdminProfile&&<AddressAutocomplete"))
  assert.ok(profile.includes("name=\"preferred_workplace\" required"))
  assert.ok(profile.includes("Voor- en achternaam"))
  assert.ok(migration.includes("if v_role='admin' then"))
  assert.ok(migration.includes("p.preferred_workplace_id is null"))
  assert.ok(migration.includes("upt_private.run_birthday_greetings()"))
  assert.ok(migration.includes("'Het is je verjaardag!🥳🎁'"))
  assert.ok(migration.includes("'birthday','/chat'"))
  assert.ok(migration.includes("values(v_person.id,null,v_channel,v_chat_body,v_chat_body)"))
  assert.ok(migration.includes("'5 * * * *'"))
  assert.ok(chat.includes("senderName=isSystem?'Up Till Dawn'"))
  assert.ok(chat.includes("translateRuntimeUi(message.body||'',uiLocale)"))
  assert.ok(runtime.includes("C’est ton anniversaire ! 🥳🎁"))
  assert.ok(runtime.includes("Happy birthday! 🥳 Have a fantastic day and make the most of it! 🎉🎉"))
  assert.ok(runtime.includes("Herzlichen Glückwunsch zum Geburtstag! 🥳"))
  assert.ok(runtime.includes("Joyeux anniversaire, ${name} ! 🥳"))
  assert.ok(runtime.includes("Happy birthday, ${name}! 🥳"))
  assert.ok(runtime.includes("Herzlichen Glückwunsch zum Geburtstag, ${name}! 🥳"))
  assert.ok(personalizedMigration.includes("select p.id,trim(p.full_name) as full_name"))
  assert.ok(personalizedMigration.includes("Van harte gefeliciteerd met je verjaardag, %s!🥳"))
  assert.ok(personalizedMigration.includes("v_person.full_name"))
  assert.ok(push.includes('"Het is je verjaardag!🥳🎁"'))
})
