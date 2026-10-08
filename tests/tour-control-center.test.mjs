import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('tour v8 has role, scenario, driver, progress and new-release coverage',async()=>{
  const config=await read('lib/tour-training.ts')
  assert.match(config,/TOUR_VERSION=8/)
  for(const role of ['employee','responsible_lead','admin'])assert.ok(config.includes('"'+role+'"'))
  for(const scenario of ['pre_event','live_event','break','post_event'])assert.ok(config.includes('"'+scenario+'"'))
  for(const key of ['overview','events','workplaces','briefings','operations','driver','tasks','incidents','inventory','guestlist','sales','personnel','crew','chat','exports','platform','settings','timesheet'])assert.ok(config.includes('key:"'+key+'"'),key)
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
  assert.match(controller,/const mobile=innerWidth<1024/)
  assert.match(controller,/\[active,current,locale,pathname\]/)
  assert.match(controller,/document\.querySelectorAll\(selector\)/)
  assert.match(controller,/viewportScore/)
  assert.match(controller,/\/api\/error-reports/)
  assert.match(controller,/localStorage\.setItem\(progressKey/)
  assert.doesNotMatch(controller,/OVERSLAAN/)
  assert.match(controller,/PAUZEER/)
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


test('admin event, workplace and briefing chapters never expose production views during tour',async()=>{
  const [events,workplaces,briefings]=await Promise.all([
    read('app/(app)/events/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('app/(app)/briefings/page.tsx'),
  ])
  for(const source of [events,workplaces,briefings]){
    assert.match(source,/params\.tour==='1'/)
    assert.match(source,/TourActiveEventDemo role="admin"/)
  }
})

test('desktop and floating tour navigation preserve sandbox query',async()=>{
  const [sidebar,layout,floating]=await Promise.all([
    read('components/layout/sidebar.tsx'),
    read('components/layout/app-layout.tsx'),
    read('components/layout/floating-chat-button.tsx'),
  ])
  assert.match(sidebar,/tourPreview\?rawHref/)
  assert.match(sidebar,/tour=1/)
  assert.match(layout,/\/chat\?tour=1/)
  assert.match(layout,/\/incidents\?tour=1/)
  assert.match(floating,/href = "\/chat"/)
  assert.match(floating,/router\.push\(href\)/)
})

test('driver sandbox visibly separates driving time and mileage and explains arrival notification',async()=>{
  const operations=await read('components/training/sandbox-operations.tsx')
  assert.match(operations,/driveSeconds/)
  assert.match(operations,/drivingTime/)
  assert.match(operations,/distanceKm/)
  assert.match(operations,/Eventtijd gepauzeerd/)
  assert.match(operations,/Backstage Management krijgt dan automatisch de aankomstmelding/)
  assert.match(operations,/setDriveSeconds\(0\)/)
})


test('staff and responsible role training follows crew then chat then settings then timesheet',async()=>{
  const source=await read('components/training/sandbox-role-module.tsx')
  for(const role of ['employee','staff','responsible_lead']){
    assert.ok(source.includes(role+':{crew:"chat",chat:"settings",settings:"timesheet"}'),role)
  }
  assert.match(source,/admin:\{personnel:"crew",crew:"chat",chat:"exports",exports:"platform",platform:"settings",settings:"timesheet"\}/)
})

test('all chapter titles and descriptions contain four nonempty translations',async()=>{
  const source=await read('lib/tour-training.ts')
  const chapters=[...source.matchAll(/\{key:"([^"]+)",route:"([^"]+)",roles:([^,]+),scenario:"([^"]+)",title:c\("([^"]+)","([^"]+)","([^"]+)","([^"]+)"\),description:c\("([^"]+)","([^"]+)","([^"]+)","([^"]+)"\)/g)]
  assert.equal(chapters.length,18,'every training chapter must have a complete translated title and description')
  for(const chapter of chapters){
    for(const value of chapter.slice(5,13))assert.ok(value.trim().length>0,chapter[1]+' has an empty translation')
  }
})

test('sandbox transition targets follow the mandatory training chapters',async()=>{
 const [features,roleModules]=await Promise.all([read('components/training/sandbox-feature-pages.tsx'),read('components/training/sandbox-role-module.tsx')])
 assert.match(features,/navTarget:"incidents"/)
 assert.match(features,/navTarget:"inventory"/)
 assert.match(features,/target\("guestlist"\)/)
 for(const role of ['employee','staff','responsible_lead'])assert.ok(roleModules.includes(role+':{crew:"chat",chat:"settings",settings:"timesheet"}'))
 assert.match(roleModules,/admin:\{personnel:"crew",crew:"chat",chat:"exports",exports:"platform",platform:"settings",settings:"timesheet"\}/)
})
