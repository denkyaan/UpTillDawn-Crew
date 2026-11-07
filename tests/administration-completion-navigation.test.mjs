import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'

const navigation=readFileSync('lib/administration/navigation.ts','utf8')
const tabs=readFileSync('components/administration/administration-navigation.tsx','utf8')

test('relations navigation exposes implemented administration destinations',()=>{
 for(const slug of ['counterparties','promotion-tasks']){
  assert.match(navigation,new RegExp('"'+slug+'"'))
  assert.ok(existsSync('app/(app)/portals/administration/'+slug+'/page.tsx'))
  assert.match(tabs,new RegExp('slug==="'+slug+'"'))
 }
 assert.match(navigation,/if\(slug==="counterparties"\|\|slug==="promotion-tasks"\)/)
})

test('navigation closes expanded subtabs on pathname changes',()=>{
 assert.match(tabs,/selectedCategory\?\.pathname===pathname/)
 assert.match(tabs,/onClick=\{\(\)=>setSelectedCategory\(null\)\}/)
})

test('notification action stays inside the notifications module',()=>{
 const page=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(page,/id="administration-notifications"/)
 assert.match(page,/href="#administration-notifications"[^\n]*Open meldingen/)
})

test('notification read action is restricted to the current user and approved administration access',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.ok(source.includes('async function markAdministrationNotificationRead(formData:FormData)'))
 assert.ok(source.includes(".eq('user_id',current.id).is('read_at',null)"))
 assert.ok(source.includes("canOpenPortal('administration'"))
 assert.ok(source.includes('action={markAdministrationNotificationRead}'))
})

test('bulk notification read only updates unread notifications owned by the current user',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 const action=source.slice(source.indexOf('async function markAllAdministrationNotificationsRead'),source.indexOf('type Translation='))
 assert.ok(action.includes('getCurrentUser()'))
 assert.ok(action.includes("canOpenPortal('administration'"))
 assert.ok(action.includes(".eq('user_id',current.id).is('read_at',null)"))
 assert.ok(source.includes('action={markAllAdministrationNotificationsRead}'))
 for(const label of ['Alle meldingen als gelezen markeren (ook andere pagina’s)','Marquer toutes les notifications comme lues (toutes les pages)','Mark all notifications as read (all pages)','Alle Benachrichtigungen als gelesen markieren (alle Seiten)'])assert.ok(source.includes(label))
})

test('administration notification links use safe route resolver rather than raw database links',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.ok(source.includes('administrationNotificationHref(item.link)'))
 assert.ok(source.includes('href={administrationNotificationHref(item.link)!}'))
 assert.ok(!source.includes('href={item.link}'))
 for(const label of ['Openen','Ouvrir','Open','Öffnen'])assert.ok(source.includes(label))
})

test('actual administration notification route forwards pagination to inbox',()=>{
 const wrapper=readFileSync('app/(app)/portals/administration/modules/notifications/page.tsx','utf8')
 const inbox=readFileSync('app/(app)/notifications/page.tsx','utf8')
 assert.ok(wrapper.includes("scope:'administration'"))
 assert.ok(wrapper.includes('searchParams={Promise.resolve({page'))
 assert.ok(inbox.includes('.range(offset,offset+pageSize)'))
 assert.ok(inbox.includes('visibleRows=data?.slice(0,pageSize)'))
 assert.ok(inbox.includes('href={pageHref(page+1)}'))
})

test('administration bottom navigation highlights exactly one category',()=>{
 assert.ok(tabs.includes('const active=visible?group.key===selected.key:group.key===current'))
 assert.ok(!tabs.includes('group.key===selected.key||(selected.key==="overview"&&group.key===current)'))
 assert.ok(tabs.includes('aria-pressed={active}'))
})

test('shared administration notification inbox resolves links inside administration portal',()=>{
 const inbox=readFileSync('app/(app)/notifications/page.tsx','utf8')
 assert.ok(inbox.includes("import { administrationNotificationHref } from '@/lib/administration/navigation'"))
 assert.ok(inbox.includes("params.scope==='administration'?administrationNotificationHref(n.link):safeNotificationLink(n.link)"))
 assert.ok(inbox.includes('<NotificationOpenLink href={safeLink}'))
 assert.ok(navigation.includes('if(url.pathname.startsWith("/portals/"))return null'))
})
