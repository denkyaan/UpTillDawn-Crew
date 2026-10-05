import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('tour v8 has role, scenario, driver, progress and new-release coverage',async()=>{
  const config=await read('lib/tour-training.ts')
  assert.match(config,/TOUR_VERSION=8/)
  for(const role of ['employee','responsible_lead','admin'])assert.ok(config.includes('"'+role+'"'))
  for(const scenario of ['pre_event','live_event','break','post_event'])assert.ok(config.includes('"'+scenario+'"'))
  for(const key of ['overview','events','workplaces','briefings','operations','driver','tasks','incidents','inventory','guestlist','sales','personnel','crew','chat','exports','platform','settings'])assert.ok(config.includes('key:"'+key+'"'),key)
  assert.match(config,/mobileSelector:string/)
  assert.match(config,/desktopSelector:string/)
  assert.match(config,/requires:"driver"/)
  assert.match(config,/newSince:8/)
  assert.match(config,/tourProgressKey/)
})

test('tour controller recovers missing targets and never writes production data',async()=>{
  const [controller,operations,events,workplaces,briefings,features,roleModules]=await Promise.all([
    read('components/training/tour-control-center.tsx'),
    read('components/training/sandbox-operations.tsx'),
    read('components/training/sandbox-events.tsx'),
    read('components/training/sandbox-workplaces.tsx'),
    read('components/training/sandbox-briefings.tsx'),
    read('components/training/sandbox-feature-pages.tsx'),
    read('components/training/sandbox-role-module.tsx'),
  ])
  assert.match(controller,/MutationObserver/)
  assert.match(controller,/scrollIntoView/)
  assert.match(controller,/matchMedia\("\(max-width: 1023px\)"\)/)
  assert.match(controller,/\/api\/error-reports/)
  assert.match(controller,/localStorage\.setItem\(progressKey/)
  assert.match(controller,/OVERSLAAN/)
  assert.match(controller,/PAUZEER/)
  assert.match(controller,/seedScenario/)
  for(const source of [operations,events,workplaces,briefings,features,roleModules]){
    assert.doesNotMatch(source,/createClient\(/)
    assert.doesNotMatch(source,/\.from\(/)
    assert.doesNotMatch(source,/\.rpc\(/)
  }
})

test('driver training contains full event-driving-return workflow',async()=>{
  const operations=await read('components/training/sandbox-operations.tsx')
  for(const token of ['"driving"','"at_person"','"returning"','START DRIVING','STOP DRIVING','Backstage'])assert.ok(operations.includes(token),token)
  assert.match(operations,/event time is running/i)
  assert.match(operations,/driving time is running/i)
})

test('help index provides persistent chapters, role preview and safe permissions explanation',async()=>{
  const [help,index,nav,roleTour]=await Promise.all([
    read('app/(app)/help/page.tsx'),
    read('components/training/tour-help-index.tsx'),
    read('components/layout/navigation-items.ts'),
    read('components/role-app-tour.tsx'),
  ])
  assert.match(help,/TourHelpIndex/)
  assert.match(index,/God Mode/)
  assert.match(index,/setRoleMode/)
  assert.match(index,/>DRIVER</)
  assert.match(index,/WHAT'S NEW/)
  assert.match(index,/camera/)
  assert.match(nav,/href:"\/help"/)
  assert.match(roleTour,/TourControlCenter/)
  assert.match(roleTour,/uptilldawn-tour-finished/)
  assert.match(roleTour,/uptilldawn-tour-stop/)
})

test('tour overview is sandboxed before production overview queries run',async()=>{
  const [dashboard,admin]=await Promise.all([read('app/(app)/page.tsx'),read('app/(app)/admin/page.tsx')])
  assert.match(dashboard,/TourActiveEventDemo/)
  assert.match(admin,/TourActiveEventDemo/)
  const adminTour=admin.indexOf("params.tour==='1'")
  const adminClient=admin.indexOf("const s=await createClient()")
  assert.ok(adminTour>0&&adminTour<adminClient,'admin tour must return before production DB queries')
  const dashboardTour=dashboard.indexOf("if(params.tour==='1')")
  const dashboardOverview=dashboard.indexOf("<DashboardOverview current")
  assert.ok(dashboardTour>0&&dashboardTour<dashboardOverview,'crew tour must return before production overview render')
})
