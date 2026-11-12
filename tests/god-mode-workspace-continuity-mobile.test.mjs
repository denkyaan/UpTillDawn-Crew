import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('installed app starts at root and restores last account-scoped workspace through server authorization',()=>{
 const pwa=read('app/manifest.ts')
 const root=read('app/(app)/page.tsx')
 const tracking=read('components/auth/workspace-continuity.tsx')
 const layout=read('app/layout.tsx')
 assert.match(pwa,/start_url:'\/'/)
 assert.match(layout,/<WorkspaceContinuity\s*\/>/)
 assert.match(tracking,/user\.id\+':'\+workspace/)
 assert.match(tracking,/path===\x27\/god-mode\x27/)
 assert.match(tracking,/path===\x27\/portals\/administration\x27/)
 assert.match(root,/saved\?\.startsWith\(current\.id\+':'\)/)
 assert.match(root,/workspace==='god-mode'&&current\.isOwner/)
 assert.match(root,/upt_god_session_valid/)
 assert.match(root,/redirect\('\/maker-mode\?portal=admin'\)/)
 assert.match(root,/workspace==='promotion'\|\|workspace==='administration'/)
 assert.match(root,/upt_my_portal_assignments/)
 assert.match(root,/grant\.approved===true&&grant\.revoked_at===null/)
})

test('normal app exit and signout clear privileged God Mode launch state',()=>{
 const god=read('lib/actions/god-mode.ts')
 const auth=read('lib/actions/auth.ts')
 const page=read('app/god-mode/page.tsx')
 assert.match(god,/export async function returnToNormalAppFromGodMode/)
 assert.match(god,/upt_current_is_owner/)
 assert.match(god,/upt_set_admin_role_mode/)
 assert.match(god,/store\.delete\(GOD_COOKIE\)/)
 assert.match(god,/store\.set\('uptilldawn-last-workspace'/)
 assert.match(page,/form action=\{returnToNormalAppFromGodMode\}/)
 assert.match(auth,/cookieStore\.delete\('uptilldawn-last-workspace'\)/)
 assert.match(auth,/cookieStore\.delete\('uptilldawn-last-portal'\)/)
})

test('God Studio menus and actual mobile tablet desktop previews remain visible on iPhones',()=>{
 const studio=read('components/god-mode/god-studio.tsx')
 const builder=read('components/god-mode/god-visual-builder.tsx')
 assert.match(studio,/grid grid-cols-2 gap-2 sm:flex sm:flex-wrap/)
 assert.match(studio,/tabNames\[locale\]\[key\]/)
 assert.match(builder,/style=\{\{width:viewportWidth,height:'72vh'\}\}/)
 assert.match(builder,/transform:\x60scale\(\$\{previewScale\}\)\x60/)
 assert.match(builder,/setFitToScreen/)
 assert.match(builder,/return 1440/)
 assert.match(builder,/return 820/)
 assert.match(builder,/return 390/)
 assert.doesNotMatch(builder,/min\(100%, \$\{widthFor\(device\)\}px\)/)
})

test('God overview cannot conflate production CI passed with deployed verified production',()=>{
 const overview=read('components/god-mode/maker-overview.tsx')
 const api=read('app/api/god/overview/route.ts')
 assert.match(overview,/state\.productionReleaseShaVerified!==true/)
 assert.match(overview,/t\.productionUnverified/)
 assert.match(api,/productionReleaseShaVerified:false/)
})

test('upload security audit distinguishes no scans from a failed audit and keeps mobile records legible',()=>{
 const page=read('app/god-mode/page.tsx')
 const audit=read('components/god-mode/upload-security-audit.tsx')
 assert.match(page,/error:securityError/)
 assert.match(page,/unavailable=\{Boolean\(securityError\)\}/)
 assert.match(audit,/unavailable\?<p role="alert"/)
 assert.match(audit,/grid gap-3 md:hidden/)
 assert.match(audit,/md:block/)
 for(const locale of ['nl','fr','en','de'])assert.match(audit,new RegExp('\\b'+locale+':\\{title:'))
})

test('Maker SQL regression uses valid PostgreSQL DO delimiters and does not bypass role checks',()=>{
 const sql=read('tests/sql/owner-leadership-privacy.sql')
 assert.doesNotMatch(sql,/DO \$BEGIN/)
 assert.equal((sql.match(/DO \$qa_assert\$/g)||[]).length,3)
 assert.equal((sql.match(/END \$qa_assert\$;/g)||[]).length,3)
 assert.match(sql,/upt_current_effective_role\(\)/)
 assert.match(sql,/upt_admin_personnel_details_v2\(\)/)
})
