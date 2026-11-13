import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('God Studio restores active role instead of assuming Admin, with Maker-only GET authorization',()=>{
 const route=read('app/api/god/preview-role/route.ts')
 const builder=read('components/god-mode/god-visual-builder.tsx')
 assert.match(route,/export async function GET\(request: Request\)/)
 assert.match(route,/authorizeStudio\(request\)/)
 assert.match(route,/upt_current_is_owner/)
 assert.match(route,/upt_current_effective_role/)
 assert.match(route,/role\.safeParse\(data\)\.success/)
 assert.match(builder,/fetch\('\/api\/god\/preview-role',\{cache:'no-store',signal:controller\.signal\}\)/)
 assert.match(builder,/setRole\(data\.role\)/)
 assert.match(builder,/setPath\(roleHome\[data\.role\]\)/)
 assert.match(builder,/disabled=\{!roleReady\|\|roleChanging\}/)
})

test('preview role changes handle server failures and restore original role on exit',()=>{
 const builder=read('components/god-mode/god-visual-builder.tsx')
 assert.match(builder,/if\(!roleReady\|\|roleChanging\|\|role===next\)return/)
 assert.match(builder,/if\(!response\.ok\|\|data\.role!==next\)throw/)
 assert.match(builder,/catch\(error\)/)
 assert.match(builder,/originalRoleRef\.current=data\.role/)
 assert.match(builder,/activeRoleRef\.current=next/)
 assert.match(builder,/keepalive:true/)
 assert.match(builder,/onClick=\{\(\)=>void switchRole\(originalRole\)\}/)
 assert.match(builder,/setRoleReload\(n=>n\+1\)/)
})

test('mobile God Mode subnavigation is complete and the preview widths are genuine',()=>{
 const studio=read('components/god-mode/god-studio.tsx')
 const builder=read('components/god-mode/god-visual-builder.tsx')
 assert.match(studio,/className="mt-2 w-full min-w-0 rounded-xl/)
 assert.match(studio,/aria-label=\{t\[section\]\} value=\{tab\}/)
 assert.match(studio,/className="hidden min-w-0 flex-wrap gap-2 sm:flex"/)
 assert.match(builder,/return 1440/)
 assert.match(builder,/return 820/)
 assert.match(builder,/return 390/)
 assert.match(builder,/transform:\x60scale\(\$\{previewScale\}\)\x60/)
 assert.match(builder,/style=\{\{width:viewportWidth,height:'72vh'\}\}/)
 assert.match(builder,/aria-pressed=\{device===item\}/)
 assert.match(builder,/Math\.round\(previewScale\*100\)/)
})

test('visual editor does not delete React controls while changing nested text',()=>{
 const builder=read('components/god-mode/god-visual-builder.tsx')
 assert.match(builder,/if\(element\.childElementCount>0\)/)
 assert.match(builder,/Behoud bestaande authenticatie, autorisatie en overige logica/)
 for(const locale of ['nl','fr','en','de']){
  assert.match(builder,new RegExp('\\b'+locale+':\\{restoreRole:'))
 }
})

test('God overview compares the active Main source with its last deployed version and clears stale data on errors',()=>{
 const overview=read('components/god-mode/maker-overview.tsx')
 assert.match(overview,/state\.deployedSha!==state\.head/)
 assert.match(overview,/heading:t\.deployedMain/)
 assert.match(overview,/state\?\.deployedSha\?\.slice\(0,8\)/)
 assert.match(overview,/setState\(null\);setError\(true\)/)
 assert.match(overview,/state\.productionReleaseShaVerified!==true/)
})
test('Maker can inspect dedicated Administration and Promotion portals from an authorized Admin preview',()=>{
 const builder=read('components/god-mode/god-visual-builder.tsx')
 const administration=read('app/(app)/portals/administration/layout.tsx')
 const promotion=read('app/(app)/portals/promotion/layout.tsx')
 assert.match(builder,/label:'Administratie',path:'\/portals\/administration'/)
 assert.match(builder,/label:'Promotie',path:'\/portals\/promotion'/)
 assert.match(administration,/if\(!user\.isOwner&&!user\.realIsAdmin\)/)
 assert.match(promotion,/if\(!current\.isOwner&&!current\.realIsAdmin\)/)
})
