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
