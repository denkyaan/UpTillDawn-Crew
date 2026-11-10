import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('notification bulk action checks unread records across every page',()=>{
 assert.ok(source.includes('const unreadNotificationCount=slug==="notifications"?await supabase.from("crew_notifications").select("id",{count:"exact",head:true})'))
 assert.ok(source.includes('.eq("user_id",current.id).is("read_at",null):null'))
 assert.ok(source.includes('(unreadNotificationCount?.count??0)>0&&<form action={markAllAdministrationNotificationsRead}>'))
 assert.ok(!source.includes('{visibleNotifications.some(item=>!item.read_at)&&<form action={markAllAdministrationNotificationsRead}>'))
})
test('bulk read label explicitly states that it includes other pages in all four locales',()=>{
 for(const label of ['ook andere pagina’s','toutes les pages','all pages','alle Seiten'])assert.ok(source.includes(label))
})

test('single and bulk read refresh administration and shared notification inboxes',()=>{
 for(const name of ['markAdministrationNotificationRead','markAllAdministrationNotificationsRead']){
  const start=source.indexOf('async function '+name+'(')
  const end=source.indexOf('\n}',start)
  assert.ok(start>=0&&end>start)
  const action=source.slice(start,end)
  assert.ok(action.includes("revalidatePath('/portals/administration/modules/notifications')"))
  assert.ok(action.includes("revalidatePath('/notifications')"))
  assert.doesNotMatch(action,/from\('crew_notifications'\)\.update/)
 }
 const single=source.slice(source.indexOf('async function markAdministrationNotificationRead'),source.indexOf('async function markAllAdministrationNotificationsRead'))
 const bulk=source.slice(source.indexOf('async function markAllAdministrationNotificationsRead'),source.indexOf('const ui='))
 assert.match(single,/rpc\('upt_mark_notification_read'/)
 assert.match(bulk,/await markAllNotificationsRead\(\)/)
 assert.match(source,/import \{markAllNotificationsRead\}/)

 }
})

test('notification pagination does not expose next-page navigation on database errors',()=>{
 assert.ok(source.includes('const notificationHasNext=!notificationRows?.error&&(notificationRows?.data?.length??0)>notificationPageSize'))
 assert.ok(source.includes('const visibleNotifications=notificationRows?.error?[]:(notificationRows?.data?.slice(0,notificationPageSize)??[])'))
 assert.ok(source.includes('notificationRows?.error?<p role="alert"'))
})

test('administration inbox pages are chronological with stable UUID tie-breaking',()=>{
 const query=source.match(/const notificationRows=slug==="notifications"[^\n]+/)
 assert.ok(query,'notification query exists')
 assert.ok(query[0].includes('.eq("user_id",current.id).order("created_at",{ascending:false}).order("id",{ascending:false})'))
 assert.ok(query[0].includes('.range(notificationOffset,notificationOffset+notificationPageSize)'))
})
