import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const read=path=>readFileSync(path,"utf8")
const clientOnly=[
 ["components/crew/lazy-chat-client.tsx","ChatClient"],
 ["components/administration/lazy-administration-overview-dashboard.tsx","AdministrationOverviewDashboard"],
 ["components/administration/lazy-administration-personnel-client.tsx","AdministrationPersonnelClient"],
 ["components/administration/lazy-administration-navigation.tsx","AdministrationNavigation"],
]

test("Main Cloudflare Free: interactive large components are not evaluated during Worker SSR",()=>{
 for(const [path,exported] of clientOnly){
  const src=read(path)
  assert.match(src,/"use client"/)
  assert.match(src,/import dynamic from "next\/dynamic"/)
  assert.match(src,/\{ssr:false,loading:/)
  assert.ok(src.includes(".then(module=>module."+exported+")"),"Missing real component: "+path)
  assert.doesNotMatch(src,/import\s*\{\s*.+?\s*\}\s*from\s*["']@\/components\/.*(?:chat-client|overview-dashboard|personnel-client|administration-navigation)["']/,
   "Unexpected eager runtime import: "+path)
 }
})

test("Main: chat still keeps authenticated SSR RLS reads and complete interactive chat props",()=>{
 const page=read("app/(app)/chat/page.tsx")
 assert.match(page,/await getCurrentUser\(\)/)
 assert.match(page,/\.from\('chat_channels'\)/)
 assert.match(page,/\.rpc\('upt_chat_channel_summaries'\)/)
 assert.match(page,/signedDirectoryPhotoUrls/)
 assert.match(page,/<LazyChatClient channels=\{ordered\} defaultChannelId=\{defaultChannelId\} userId=\{user\.id\}/)
 assert.match(page,/initialChannelStates=\{initialChannelStates\}/)
 assert.match(page,/privatePeerIds=\{privatePeerIds\}/)
 assert.match(page,/focusMessageId=\{params\.message\|\|null\}/)
})

test("Main: Administration continues server-checking role access before client-only UI",()=>{
 const layout=read("app/(app)/portals/administration/layout.tsx")
 const home=read("app/(app)/portals/[portal]/page.tsx")
 const personnel=read("app/(app)/portals/administration/personnel/page.tsx")
 assert.match(layout,/await getCurrentUser\(\)/)
 assert.match(layout,/currentPortalAssignments\(\)/)
 assert.match(layout,/!canOpenPortal\("administration"/)
 assert.match(layout,/<LazyAdministrationNavigation initialLocale=\{locale\} canManagePromotion=/)
 assert.match(home,/canOpenPortal\(portal/)
 assert.match(home,/<LazyAdministrationOverviewDashboard locale=\{locale\} currentUserId=\{current\.id\} admin=/)
 assert.match(personnel,/await getCurrentUser\(\)/)
 assert.match(personnel,/<LazyAdministrationPersonnelClient initialLocale=\{locale\} currentUserId=\{user\.id\}/)
})

test("Main: original interactive components remain unmodified and browser data still relies on RLS",()=>{
 const original=[
 "components/crew/chat-client.tsx",
 "components/administration/administration-navigation.tsx",
 "components/administration/administration-personnel-client.tsx",
 "components/administration/administration-overview-dashboard.tsx",
 ]
 for(const file of original)assert.ok(read(file).length>4000,file)
 assert.match(read(original[2]),/db\.rpc\("upt_crew_directory"\)/)
 assert.match(read(original[3]),/db\.from\("timesheets"\)/)
})
