import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PORTALS,userVisiblePortals} from '../lib/portal-access.ts'

const active={approved:true,blocked:false,isOwner:false,realIsAdmin:false,role:'staff'}
const grant=(portal,role,extra={})=>({portal,role,approved:true,revoked_at:null,...extra})
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('a multi-role staff account sees each approved portal without duplicated tabs',()=>{
 const choices=userVisiblePortals([
  grant('events','event_staff'),grant('promotion','promoter'),grant('promotion','promoter'),
  grant('administration','administrative_staff')
 ],active)
 assert.deepEqual(choices,[...PORTALS])
 assert.deepEqual(userVisiblePortals([grant('promotion','promoter')],active),['events','promotion'])
 assert.deepEqual(userVisiblePortals([grant('promotion','promoter')],{...active,role:'external'}),['promotion'])
})

test('revoked or pending grants and role previews never turn into administrative permissions',()=>{
 const pending=[grant('promotion','promoter',{approved:false}),
  grant('administration','administrative_staff',{revoked_at:'2026-11-09T12:00:00Z'}),
  grant('administration','promoter')]
 assert.deepEqual(userVisiblePortals(pending,active),['events'])
 assert.deepEqual(userVisiblePortals(pending,{...active,role:'external'}),[])
 assert.deepEqual(userVisiblePortals(pending,{...active,approved:false}),[])
 assert.deepEqual(userVisiblePortals(pending,{...active,blocked:true}),[])
 assert.deepEqual(userVisiblePortals(pending,{...active,role:'admin',realIsAdmin:false}),[])
})

test('permanent admins agree with actual portal layout access; owner exception is explicit',()=>{
 assert.deepEqual(userVisiblePortals([],{...active,role:'admin',realIsAdmin:true}),[...PORTALS])
 assert.deepEqual(userVisiblePortals([],{...active,role:'admin',realIsAdmin:true,blocked:true}),[])
 assert.deepEqual(userVisiblePortals([],{...active,approved:false,isOwner:true}),[...PORTALS])
})

test('portal chooser is explicit for multi-role accounts and all links update portal cookie',()=>{
 const chooser=read('app/(app)/portals/page.tsx')
 const switchRoute=read('app/(app)/portals/switch/[portal]/route.ts')
 assert.ok(chooser.includes("if(portals.length===1)redirect('/portals/switch/'+portals[0])"))
 assert.doesNotMatch(chooser,/portals\.length\s*>\s*1\s*&&\s*last/)
 assert.match(chooser,/href=\{'\/portals\/switch\/'\+portal\}/)
 assert.match(chooser,/userVisiblePortals\(/)
 assert.match(switchRoute,/userVisiblePortals\(/)
 assert.match(switchRoute,/allowed\.includes\(portal as Portal\)/)
 assert.match(switchRoute,/response\.cookies\.set\("uptilldawn-last-portal"/)
 assert.doesNotMatch(switchRoute,/user\.isOwner\|\|allowed\.includes/)
})

test('active portal is distinguishable with accessible navigation and chooser link',()=>{
 const shell=read('components/layout/portal-switcher.tsx')
 const client=read('components/layout/portal-switcher-links.tsx')
 assert.match(shell,/userVisiblePortals/)
 assert.match(client,/usePathname\(/)
 assert.match(client,/aria-current=\{current===portal\?'page':undefined\}/)
 assert.match(client,/href="\/portals"/)
 for(const route of ['/portals/administration','/portals/promotion'])assert.ok(client.includes(route))
})

test('four languages cover chooser, role approval, revocation and pagination',()=>{
 for(const path of [
  'app/(app)/portals/page.tsx',
  'components/layout/portal-switcher-links.tsx',
  'app/(app)/portals/roles/page.tsx',
  'app/(app)/portals/roles/role-management-form.tsx',
 ]){
  const code=read(path)
  for(const locale of ['nl:','fr:','en:','de:'])assert.ok(code.includes(locale),path+' '+locale)
 }
 const roles=read('app/(app)/portals/roles/page.tsx')
 assert.match(roles,/count:'exact'/)
 assert.match(roles,/\.range\(from,from\+pageSize-1\)/)
 assert.match(roles,/RoleQuickAction[\s\S]*locale=\{locale\}/)
 const form=read('app/(app)/portals/roles/role-management-form.tsx')
 assert.match(form,/changePortalRole\(formData\)/)
 assert.match(form,/changePortalRole\(form\)/)
 assert.match(form,/window\.confirm\(t\.confirm\)/)
 assert.match(form,/userId\|\|!selectedUserVisible/)
})
