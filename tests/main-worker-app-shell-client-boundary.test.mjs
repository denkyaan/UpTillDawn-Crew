import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const root=readFileSync('app/(app)/layout.tsx','utf8')
const lazy=readFileSync('components/layout/lazy-app-layout.tsx','utf8')
const app=readFileSync('components/layout/app-layout.tsx','utf8')
const serverAuth=readFileSync('lib/actions/auth.ts','utf8')

test('shared authenticated Next layout defers expensive app shell until after server authentication',()=>{
 assert.match(root,/const current = await getCurrentUser\(\)/)
 assert.match(root,/if \(!current\) redirect\('\/login'\)/)
 assert.match(root,/<LazyAppLayout>/)
 assert.match(root,/<PortalSwitcher \/>/)
 assert.match(root,/<LazyOfflineContentSync userId=\{user\.id\}\/>/)
 assert.match(root,/<ErrorReportBridge\/>/)
 assert.doesNotMatch(root,/import \{ AppLayout \} from/)
 assert.match(lazy,/"use client"/)
 assert.match(lazy,/import dynamic from "next\/dynamic"/)
 assert.match(lazy,/\{ssr:false,loading:/)
 assert.match(lazy,/import\("@\/components\/layout\/app-layout"\)\.then\(module=>module\.AppLayout\)/)
 assert.match(lazy,/import \{activeUiLocale\} from/)
 for(const locale of ['nl','fr','en','de'])assert.ok(lazy.includes(locale+':'),locale+' loading locale missing')
 assert.match(serverAuth,/upt_current_session_context/)
 assert.match(serverAuth,/export const getCurrentUser = cache\(/)
})

test('do not discard existing full navigation, unread, role, chat, help or AI functionality',()=>{
 for(const token of ['AppSidebar','Topbar','MobileBottomNav','FloatingChatButton','AdminContextBar','QueueStatus','PlatformAiAssistant','AdministrationAiChat','role_ui_rules','upt_chat_unread_total','uptilldawn-navigation-expanded']){
  assert.ok(app.includes(token),'App shell feature lost: '+token)
 }
 // The full shell still wraps the SAME authorized route content after hydration.
 // The context provider only exposes that content while browser JS loads.
 assert.ok(lazy.includes('return <ShellChildrenContext.Provider value={children}>'))
 assert.ok(lazy.includes('<ClientShell>{children}</ClientShell>'))
 assert.ok(lazy.includes('{content}'))
})

test('browser acceptance is still required to fail on Worker overload, not accept it as a denial',()=>{
 const browser=readFileSync('scripts/e2e-seven-main-bots.mjs','utf8')
 const outcomes=readFileSync('scripts/main-worker-outcomes.mjs','utf8')
 assert.match(browser,/Cloudflare Worker 1102 resource exhaustion/)
 assert.match(browser,/if\(status>=500\)throw Error/)
 assert.match(outcomes,/if\(observedFailures!==null&&observedFailures>0\)/)
 assert.match(outcomes,/process\.exitCode=1/)
})
