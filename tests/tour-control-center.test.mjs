import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

const operationalPages=[
  'app/(app)/page.tsx','app/(app)/admin/page.tsx','app/(app)/events/page.tsx',
  'app/(app)/workplaces/page.tsx','app/(app)/briefings/page.tsx',
  'app/(app)/operations/page.tsx','app/(app)/chat/page.tsx',
  'app/(app)/guestlist/page.tsx','app/(app)/inventory/page.tsx',
  'app/(app)/tasks/page.tsx','app/(app)/incidents/page.tsx',
  'app/(app)/sales/page.tsx','app/(app)/personnel/page.tsx',
  'app/(app)/exports/page.tsx','app/(app)/crew/page.tsx',
]

test('production pages no longer route to tour or sandbox screens',async()=>{
  for(const path of operationalPages){
    const source=await read(path)
    assert.doesNotMatch(source,/params\.tour|tour=1|<Sandbox|<TourActiveEventDemo|@\/components\/training\//,path)
  }
})

test('navigation never adds tour query parameters',async()=>{
  const [sidebar,nav,layout]=await Promise.all([
    read('components/layout/sidebar.tsx'),
    read('components/layout/navigation-items.ts'),
    read('components/layout/app-layout.tsx'),
  ])
  assert.doesNotMatch(sidebar,/tourPreview|tour=1|uptilldawn-tour-preview/)
  assert.doesNotMatch(nav,/Rondleidingen & training/)
  assert.doesNotMatch(layout,/tourPreview|tour=1|RoleAppTour/)
})

test('operational onboarding and briefings remain available',async()=>{
  const [onboarding,briefings,events]=await Promise.all([
    read('app/(app)/onboarding/page.tsx'),
    read('app/(app)/briefings/page.tsx'),
    read('app/(app)/events/page.tsx'),
  ])
  assert.ok(onboarding.length>100)
  assert.match(briefings,/acknowledgeBriefing/)
  assert.match(events,/event_members/)
})
