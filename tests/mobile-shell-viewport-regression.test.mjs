import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('root viewport is pinned to the physical device width for iOS/PWA mobile controls',async()=>{
  const layout=await read('app/layout.tsx')
  assert.match(layout,/width:\s*['"]device-width['"]/)
  assert.match(layout,/initialScale:\s*1/)
})

test('mobile bottom navigation and floating chat remain mounted in the authenticated shell',async()=>{
  const [shell,nav,chat]=await Promise.all([
    read('components/layout/app-layout.tsx'),
    read('components/layout/mobile-nav.tsx'),
    read('components/layout/floating-chat-button.tsx'),
  ])
  assert.match(shell,/<MobileBottomNav/)
  assert.match(shell,/<FloatingChatButton/)
  assert.match(shell,/const showFloatingChat=showChat/)
  assert.match(shell,/const showChat=feature\("chat",true\)&&!pathname\.startsWith\("\/chat"\)/)
  assert.match(nav,/fixed inset-x-0 bottom-0/)
  assert.match(nav,/lg:hidden/) 
  assert.match(nav,/min-h-14/)
  assert.match(chat,/className="fixed z-50/)
  assert.match(chat,/lg:hidden/)
})
