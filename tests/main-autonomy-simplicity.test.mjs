import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const notifications=readFileSync('app/(app)/notifications/page.tsx','utf8')
const automations=readFileSync('components/admin/automation-manager.tsx','utf8')

test('shared notification inbox prioritizes unread and retains complete history',()=>{
  assert.match(notifications,/const selectedView=params\.view==='all'\?'all':'unread'/)
  assert.match(notifications,/selectedView==='unread'\?notificationQuery\.is\('read_at',null\):notificationQuery/)
  assert.match(notifications,/\.eq\('user_id',user\.id\)/)
  assert.match(notifications,/\.neq\('kind', 'error_report'\)/)
  assert.match(notifications,/\.order\('id',\{ascending:false\}\)/)
  assert.match(notifications,/const pageHref=.*selectedView/)
  assert.match(notifications,/aria-current=\{selectedView==='unread'/)
  assert.match(notifications,/aria-current=\{selectedView==='all'/)
})

test('inbox navigation and empty states have explicit Dutch French English and German copy',()=>{
  for(const label of ['Ongelezen','Non lues','Unread','Ungelesen','Alle meldingen','Toutes les notifications','All notifications','Alle Mitteilungen']) {
    assert.ok(notifications.includes(label),label)
  }
  assert.match(notifications,/selectedView==='unread'\?labels\.empty/)
})

test('automation settings are compact without weakening manual approval or audit trail',()=>{
  assert.match(automations,/<details key=\{rule\.automation_key\}/)
  assert.match(automations,/<summary className=/)
  assert.match(automations,/staleCount/)
  assert.match(automations,/observedAt/)
  assert.doesNotMatch(automations,/Date\.now\(\)/)
  assert.match(automations,/healthLabel/)
  assert.match(automations,/saveAutomationRule/)
  assert.match(automations,/PendingSubmitButton/)
  assert.match(automations,/Kritieke beslissingen/)
  assert.match(automations,/rule\.audit_enabled/)
  assert.match(automations,/managed==='workflow'/)
})
