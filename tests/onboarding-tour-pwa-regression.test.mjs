import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('role tour is hydration-safe and opens real tabs without full reloads',async()=>{
  const [tour,layout,mobile,controller]=await Promise.all([
    read('components/role-app-tour.tsx'),
    read('components/layout/app-layout.tsx'),
    read('components/layout/mobile-nav.tsx'),
    read('components/training/tour-control-center.tsx'),
  ])
  assert.match(tour,/useState<ExtendedUiLocale>\("nl"\)/)
  assert.doesNotMatch(tour,/initialUiLocale\(/)
  assert.match(tour,/<TourControlCenter active=\{open\}/)
  assert.doesNotMatch(tour,/router\.push\(step\.route\)/)
  assert.doesNotMatch(controller,/router\.push\(tourRoute\(role,next\)\)/)
  assert.match(controller,/awaitingNavigationRef\.current=next\.key/)
  assert.match(controller,/setNavigationTarget\(tourBaseRoute\(role,next\)\)/)
  assert.match(controller,/data-upt-training-next-tab/)
  assert.doesNotMatch(controller,/location\.assign\(/)
  assert.doesNotMatch(tour,/location\.assign\(step\.route\)/)
  assert.match(tour,/inside:\[/)
  assert.match(tour,/ROLE_FEATURES\.responsible_lead\.map/)
  assert.match(tour,/ROLE_FEATURES\.admin\.map/)
  assert.match(layout,/const currentUsable=previewAll\|\|/)
  assert.doesNotMatch(mobile,/if\(detail\?\.active\)setExpanded\(true\)/)
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
