import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('retired role tour is absent from the operational layout',async()=>{
 const layout=await read('components/layout/app-layout.tsx')
 assert.doesNotMatch(layout,/RoleAppTour|TourControlCenter|tourPreview/)
})

test('registration queues the PWA install prompt even before an auth session exists',async()=>{
  const [signup,prompt,helper]=await Promise.all([
    read('app/(auth)/signup/page.tsx'),
    read('components/first-use-install-prompt.tsx'),
    read('lib/pwa-install-prompt.ts'),
  ])
  assert.match(signup,/queuePwaInstallPrompt\(\)/)
  assert.match(helper,/PWA_INSTALL_PROMPT_PENDING_KEY/)
  assert.match(prompt,/localPending/)
  assert.match(prompt,/localPending\|\|accountPending/)
  assert.doesNotMatch(prompt,/if\(!visible\|\|!user\)return null/)
  assert.match(prompt,/isIos\(\)/)
  assert.match(prompt,/Add to Home Screen/)
})
