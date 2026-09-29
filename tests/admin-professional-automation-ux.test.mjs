import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('admin primary navigation stays consolidated and professional',async()=>{
  const [rules,help,settings,approvals,crew]=await Promise.all([
    read('lib/role-ui.ts'),
    read('lib/ui-field-help.ts'),
    read('app/(app)/settings/page.tsx'),
    read('app/(app)/personnel/page.tsx'),
    read('app/(app)/crew/page.tsx'),
  ])
  for(const [key,label] of [
    ['overview','Overzicht'],['events','Evenementen'],['workplaces','Werkplaatsen & shifts'],
    ['operations','Werkuren'],['tasks','Taken'],['sales','Sales'],['personnel','Goedkeuringen'],
    ['crew','Personeel'],['chat','Chats'],['incidents','Help'],['settings','Beheer'],
  ])assert.match(rules,new RegExp(`navRule\\("admin","${key}","${label.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}"`))
  for(const key of ['inventory','guestlist','briefings','exports','platform'])assert.match(rules,new RegExp(`navRule\\("admin","${key}"[^\\n]+,"never",false,false\\)`))
  assert.match(help,/Centrale actiequeue/)
  assert.match(settings,/Platform & automatiseringen/)
  assert.match(approvals,/uitsluitend nieuwe accountaanvragen/i)
  assert.match(crew,/Beheer goedgekeurde medewerkers/i)
})

test('persistent automation engine is cron-driven, configurable, deduplicated and safe',async()=>{
  const [migration,auditMigration,manager,action,engine]=await Promise.all([
    read('supabase/migrations/20260929084633_persistent_admin_automation_engine.sql'),
    read('supabase/migrations/20260929085323_automation_rule_audit_rpc.sql'),
    read('components/admin/automation-manager.tsx'),
    read('lib/actions/platform.ts'),
    read('lib/automation-engine.ts'),
  ])
  assert.match(migration,/create table if not exists public\.automation_rules/)
  assert.match(migration,/upt_private\.automation_deliveries/)
  assert.match(migration,/unique\(automation_key,dedupe_key,user_id\)/)
  assert.match(migration,/refresh_admin_workflow_automations/)
  assert.match(migration,/run_automation_cycle/)
  assert.match(migration,/uptilldawn-operational-alerts/)
  for(const rule of ['account_approval_reminder','event_readiness','event_close_ready','open_task_shift_reminder','operational_alerts','incident_escalation'])assert.ok(migration.includes(`'${rule}'`))
  assert.match(migration,/Accounts worden nooit automatisch goedgekeurd/)
  assert.match(auditMigration,/automation\.rule\.updated/)
  assert.match(action,/upt_save_automation_rule/)
  assert.match(manager,/Timing & leveringsregels aanpassen/)
  assert.match(manager,/PendingSubmitButton/)
  assert.match(engine,/cooldownMinutes/)
})

test('click context persists across modules and prefills the next relevant action',async()=>{
  const [provider,contextLink,bar,admin,tasks,briefings,workplaces,chat,sales,help]=await Promise.all([
    read('lib/admin-selection-context.tsx'),
    read('components/admin/context-link.tsx'),
    read('components/admin/admin-context-bar.tsx'),
    read('app/(app)/admin/page.tsx'),
    read('app/(app)/tasks/page.tsx'),
    read('app/(app)/briefings/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('app/(app)/chat/page.tsx'),
    read('app/(app)/sales/page.tsx'),
    read('app/(app)/incidents/page.tsx'),
  ])
  for(const key of ['eventId','workplaceId','userId','shiftId','focus'])assert.ok(provider.includes(key))
  assert.match(provider,/localStorage/)
  assert.match(contextLink,/setSelection/)
  assert.match(bar,/Context/)
  assert.match(admin,/ContextLink/)
  assert.match(tasks,/defaultWorkplaceId=\{params\.workplace/)
  assert.match(briefings,/defaultPersonId=\{params\.user/)
  assert.match(workplaces,/context=\{\{eventId:workplace\.event_id,workplaceId:workplace\.id,focus:'inventory'\}\}/)
  assert.match(workplaces,/href="\/sales" context=\{\{eventId:workplace\.event_id,workplaceId:workplace\.id,focus:'sales'\}\}/)
  assert.match(chat,/params\.workplace/)
  assert.match(sales,/transactions\.filter\(transaction=>transaction\.workplace_id===params\.workplace\)/)
  assert.match(help,/help-focus/)
})

test('critical clicks are guarded against duplicate or accidental destructive submissions',async()=>{
  const [pending,archive,deleteButton,crew]=await Promise.all([
    read('components/ui/pending-submit-button.tsx'),
    read('components/events/archive-event-button.tsx'),
    read('components/admin/personnel-delete-button.tsx'),
    read('app/(app)/crew/page.tsx'),
  ])
  assert.match(pending,/useFormStatus/)
  assert.match(pending,/disabled=\{Boolean\(props\.disabled\)\|\|pending\}/)
  assert.doesNotMatch(archive,/window\.confirm/)
  assert.match(deleteButton,/confirmation\.trim\(\)===name\.trim\(\)/)
  assert.match(deleteButton,/Account definitief verwijderen\?/)
  assert.match(crew,/PersonnelDeleteButton/)
})

test('new automation and admin UX has explicit four-language coverage',async()=>{
  const translations=await read('lib/ui-translation-complete.ts')
  for(const key of [
    'Automatiseringen','AUTOMATISERING OPSLAAN','Open accountgoedkeuring','Event readiness',
    'Klaar om evenement af te sluiten','Open taken vóór shift','VERANTWOORDELIJKE ONTBREEKT',
    'LAGE VOORRAAD','CHECKLIST OPEN','Timing & leveringsregels aanpassen',
  ]){
    const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    assert.match(translations,new RegExp(`'${escaped}': \\{ fr: '.+?', en: '.+?', de: '.+?' \\}`),key)
  }
})


test('admin overview uses a prioritized contextual action center',async()=>{
  const [page,center,translations]=await Promise.all([
    read('app/(app)/admin/page.tsx'),
    read('components/admin/action-center.tsx'),
    read('lib/ui-translation-complete.ts'),
  ])
  assert.match(page,/AdminActionCenter items=\{actionQueue\}/)
  assert.match(page,/missing-checkout/)
  assert.match(page,/priority:/)
  assert.match(center,/critical:0,high:1,normal:2,info:3/)
  assert.match(center,/gesorteerd op urgentie/)
  for(const key of ['HOOG','NORMAAL','INFO','STOPUREN ONTBREKEN','ONDERBEZETTING'])assert.ok(translations.includes(`'${key}': { fr:`),key)
})


test('notification clicks preserve admin context and smart alerts deep link to exact modules',async()=>{
  const [page,link,migration]=await Promise.all([
    read('app/(app)/notifications/page.tsx'),
    read('components/admin/notification-open-link.tsx'),
    read('supabase/migrations/20260929091000_notification_context_deeplinks.sql'),
  ])
  assert.match(page,/NotificationOpenLink/)
  assert.match(link,/selectionFromHref/)
  assert.match(link,/eventFromPath/)
  assert.match(migration,/responsible-missing.*\/workplaces/s)
  assert.match(migration,/briefing-unread.*\/briefings/s)
  assert.match(migration,/inventory-low.*\/inventory/s)
  assert.match(migration,/focus=/)
})
