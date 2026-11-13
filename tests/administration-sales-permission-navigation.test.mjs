import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Administration Sales is canonical and does not reject approved administrative staff',()=>{
 const navigation=read('lib/administration/navigation.ts')
 const sales=read('app/(app)/portals/administration/sales/page.tsx')
 const layout=read('app/(app)/portals/administration/layout.tsx')
 assert.match(navigation,/slugs:\[[^\]]*"sales"/)
 assert.match(navigation,/if\(\["personnel","chat","finance","rosters","promotion-discipline","timesheets","profile","sales"\]/)
 assert.match(sales,/const access=await administrationAccess\(\)/)
 assert.match(sales,/if\(!access\.ok\)redirect\('\/portals'\)/)
 assert.doesNotMatch(sales,/if\(!access\.user\.realIsAdmin\)redirect/)
 assert.match(sales,/return SalesPage\(\{searchParams\}\)/)
 assert.match(layout,/canOpenPortal\("administration"/)
})
