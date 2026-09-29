import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('admin primary navigation is consolidated while nested workflows remain reachable',async()=>{
  const [roles,nav,layout,settings,workplaces,operations]=await Promise.all([
    read('lib/role-ui.ts'),
    read('components/layout/navigation-items.ts'),
    read('components/layout/app-layout.tsx'),
    read('app/(app)/settings/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('app/(app)/operations/page.tsx'),
  ])

  for(const [key,label] of [
    ['overview','Overzicht'],['events','Evenementen'],['workplaces','Werkplaatsen & shifts'],
    ['operations','Werkuren'],['tasks','Taken'],['sales','Sales'],['personnel','Goedkeuringen'],
    ['crew','Personeel'],['chat','Chats'],['incidents','Help'],['settings','Beheer'],
  ]){
    assert.match(roles,new RegExp(`navRule\\("admin","\${key}","\${label}"`))
  }

  for(const key of ['inventory','guestlist','briefings','exports','platform']){
    assert.match(roles,new RegExp(`navRule\\("admin","\${key}"[^\\n]+,"never",false,false\\)`))
  }

  assert.match(nav,/label:"Goedkeuringen"/)
  assert.match(nav,/label:"Chats"/)
  assert.match(nav,/label:"Beheer"/)
  assert.match(layout,/pathname\.startsWith\("\/inventory"\)/)
  assert.match(layout,/pathname\.startsWith\("\/guestlist"\)/)
  assert.match(layout,/pathname\.startsWith\("\/briefings"\)/)
  assert.match(settings,/Platform & automatiseringen/)
  assert.match(workplaces,/ContextLink href="\/inventory"/)
  assert.match(workplaces,/ContextLink href="\/guestlist"/)
  assert.match(operations,/Excel exporteren/)
})

test('admin click context persists across related modules and action-center clicks are contextual',async()=>{
  const [provider,link,bar,layout,admin,events,workplaces,operationsClient]=await Promise.all([
    read('lib/admin-selection-context.tsx'),
    read('components/admin/context-link.tsx'),
    read('components/admin/admin-context-bar.tsx'),
    read('app/layout.tsx'),
    read('app/(app)/admin/page.tsx'),
    read('app/(app)/events/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('app/(app)/operations/operations-client.tsx'),
  ])

  assert.match(provider,/uptilldawn-admin-selection-v1/)
  assert.match(provider,/localStorage/)
  assert.match(provider,/eventId/)
  assert.match(provider,/workplaceId/)
  assert.match(link,/setSelection/)
  assert.match(layout,/AdminSelectionProvider/)
  assert.match(bar,/Context wissen/)
  assert.match(bar,/featureHelp\("inventory"/)
  assert.match(admin,/ContextLink/)
  assert.match(admin,/focus:'checkin'/)
  assert.match(events,/focus:'briefing'/)
  assert.match(workplaces,/focus:'inventory'/)
  assert.match(operationsClient,/data-focus-match/)
  assert.match(operationsClient,/scrollIntoView/)
})

test('automation manager is persistent, configurable, audited and keeps destructive decisions manual',async()=>{
  const [manager,actions,engine,migration,auditMigration,platform,help]=await Promise.all([
    read('components/admin/automation-manager.tsx'),
    read('lib/actions/platform.ts'),
    read('lib/automation-engine.ts'),
    read('supabase/migrations/20260929084633_persistent_admin_automation_engine.sql'),
    read('supabase/migrations/20260929085323_automation_rule_audit_rpc.sql'),
    read('app/(app)/admin/platform/page.tsx'),
    read('lib/ui-field-help.ts'),
  ])

  assert.match(manager,/AUTOMATION ENGINE/)
  assert.match(manager,/Kritieke beslissingen/)
  assert.match(manager,/cooldown_minutes/)
  assert.match(manager,/max_retries/)
  assert.match(actions,/upt_save_automation_rule/)
  assert.doesNotMatch(actions,/from\('automation_rules'\)\.update/)
  assert.match(engine,/AutomationRule/)
  assert.match(migration,/create table if not exists public\.automation_rules/)
  assert.match(migration,/refresh_admin_workflow_automations/)
  assert.match(migration,/run_automation_cycle/)
  assert.match(migration,/account_approval_reminder/)
  assert.match(migration,/event_readiness/)
  assert.match(migration,/event_close_ready/)
  assert.match(migration,/open_task_shift_reminder/)
  assert.match(auditMigration,/automation\.rule\.updated/)
  assert.match(auditMigration,/upt_audit_logs/)
  assert.match(platform,/AutomationManager/)
  assert.match(help,/automations:\{label:'Automatiseringen'/)
})
