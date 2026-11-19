import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {channelTitle,chatCopy,visibleChatChannels} from "../src/shared/chat-ui.ts"
import {languages} from "../src/shared/i18n.ts"
import {canRememberRoute,resolvePortalPreference} from "../src/shared/portal-preference.ts"

const uid="11111111-1111-4111-8111-111111111111"
const promotion={userId:uid,role:"staff",isOwner:false,portals:["promotion"]}
const eventOnly={...promotion,portals:["events"]}
const both={...promotion,portals:["events","promotion","administration"]}
const channels=[
 {id:"1",kind:"organization",name:"Algemene chat promotie"},
 {id:"2",kind:"organization",name:"Algemene chat evenementen"},
 {id:"3",kind:"organization",name:"Admin · Administratie"},
 {id:"4",kind:"event",name:"Evenement XYZ"},
 {id:"5",kind:"private",name:"Persoonlijk"},
]
test("promotion sees only its canonical group chat; events and admins keep authorized channel list",()=>{
 assert.deepEqual(visibleChatChannels(channels,"promotion").map(x=>x.id),["1"])
 assert.deepEqual(visibleChatChannels(channels,"events"),channels)
 assert.deepEqual(visibleChatChannels([{id:"other",kind:"private",name:"Algemene chat promotie"}],"promotion"),[])
})
test("promotion-only user can resume exactly one own chat route, not events or finance",()=>{
 assert.equal(canRememberRoute("/portals/promotion/chat",promotion),true)
 assert.equal(canRememberRoute("/chat",promotion),false)
 assert.equal(canRememberRoute("/portals/administration",promotion),false)
 assert.equal(resolvePortalPreference("/portals/promotion/chat",eventOnly),"/overview")
 assert.equal(resolvePortalPreference("/portals/promotion/chat",both),"/portals/promotion/chat")
})
test("fixed room labels and live messages remain distinct in four languages",()=>{
 for(const locale of languages){
  const labels=chatCopy(locale)
  for(const key of ["channels","loading","historyError","empty","you","moderated","readers","readersFailed","noReaders","send","queued","partial","accountFailed","retry","discard","parity"])
   assert.ok(labels[key].length>2,locale+":"+key)
  assert.ok(channelTitle("Algemene chat promotie",locale).length>2)
  assert.ok(channelTitle("Admin · Administratie",locale).length>2)
  assert.equal(channelTitle("User-created room",locale),"User-created room")
 }
})
test("promotion link uses its own guarded route and all writes remain behind migration flag",()=>{
 const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8")
 const main=read("main.tsx"),promotionUI=read("screens/promotion.tsx")
 const chats=read("screens/chats.tsx"),readers=read("lib/chat-readers.ts")
 assert.ok(main.includes('<PortalGuard portal="promotion"><Suspense fallback="Chat laden…"><Chats scope="promotion"/>'))
 assert.ok(promotionUI.includes('to="/portals/promotion/chat"'))
 assert.ok(!promotionUI.includes('to="/chat"'))
 assert.ok(chats.includes("visibleChatChannels(list.data||[],scope)"))
 assert.ok(chats.includes("MIGRATION_WRITES_ENABLED"))
 assert.ok(chats.includes(".on(\"postgres_changes\""))
 assert.ok(readers.includes('rpc("upt_chat_message_readers"'))
 assert.ok(readers.includes("withReadBudget("))
 assert.ok(readers.includes(".abortSignal(signal)"))
 assert.ok(!readers.includes("service_role"))
 assert.ok(!readers.includes("localStorage"))
})
