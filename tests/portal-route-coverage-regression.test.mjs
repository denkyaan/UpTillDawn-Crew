import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'

const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])
const pages=walk('app/(app)/portals').filter(p=>p.endsWith('/page.tsx'))
const names=pages.map(p=>p.replace(/^app\/\(app\)/,'').replace(/\/page\.tsx$/,''))
const requiredAdmin=['/portals/administration','/portals/administration/overview','/portals/administration/finance','/portals/administration/rosters','/portals/administration/modules/artists','/portals/administration/modules/documents','/portals/administration/modules/invoices','/portals/administration/modules/banking','/portals/administration/modules/inventory','/portals/administration/modules/notifications','/portals/administration/modules/reports','/portals/administration/modules/settings','/portals/administration/promotion-discipline']
const requiredPromotion=['/portals/promotion','/portals/promotion/tasks']

test('all required administration and promotion route files exist',()=>{
 for(const route of [...requiredAdmin,...requiredPromotion])assert.ok(names.includes(route),'missing '+route)
})
test('all portal route files export a default page component',()=>{
 for(const file of pages){
  const src=readFileSync(file,'utf8')
  assert.match(src,/export\s+default\s+(?:async\s+)?(?:function|class)|export\s*\{[^}]+\bas\s+default\b|export\s+default\s+[A-Za-z_$]/,'missing default export: '+file)
 }
})
test('portal inventory script includes both portal trees and interactive controls',()=>{
 const script=readFileSync('scripts/functional-control-inventory.mjs','utf8')
 assert.match(script,/walk\('app'\)/)
 assert.match(script,/walk\('components'\)/)
 for(const tag of ['button','Button','input','select','textarea','form'])assert.ok(script.includes(tag),'missing control kind '+tag)
})
