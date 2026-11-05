import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const navigation=readFileSync(new URL('../components/administration/administration-navigation.tsx',import.meta.url),'utf8')
const mobile=readFileSync(new URL('../components/administration/administration-mobile-tabs.tsx',import.meta.url),'utf8')
const routes=readFileSync(new URL('../lib/administration/navigation.ts',import.meta.url),'utf8')

test('administration overview does not navigate again when already on overview',()=>{
 assert.match(navigation,/pathname!=="\/portals\/administration"&&router\.push\("\/portals\/administration"\)/)
})

test('mobile administration subtabs use canonical routes',()=>{
 assert.match(mobile,/import \{ administrationRoute, administrationCategoryForPath \} from "@\/lib\/administration\/navigation"/)
 assert.match(mobile,/function href\(slug:string\)\{return administrationRoute\(slug\)\}/)
 assert.match(routes,/"personnel","chat","finance","rosters","promotion-discipline","timesheets","profile","sales"/)
})
