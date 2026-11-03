import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('mapping API checks permissions and origin before mutations',()=>{
 const post=read('../app/api/administration/provider-mappings/route.ts')
 const patch=read('../app/api/administration/provider-mappings/[id]/route.ts')
 for(const source of [post,patch]){assert.match(source,/administrationAccess\(/);assert.match(source,/sameOrigin\(request\)/);assert.match(source,/no-store/)}
})
test('new mappings are disabled and identity cannot be edited',()=>{
 const post=read('../app/api/administration/provider-mappings/route.ts')
 const patch=read('../app/api/administration/provider-mappings/[id]/route.ts')
 assert.match(post,/enabled:false/)
 assert.match(patch,/Object\.keys\(input\)\.length!==1/)
 assert.match(patch,/typeof input\.enabled!=="boolean"/)
})

test('activation requires administration access and request payloads have real byte limits',()=>{
 const post=read('../app/api/administration/provider-mappings/route.ts')
 const patch=read('../app/api/administration/provider-mappings/[id]/route.ts')
 assert.match(patch,/administrationAccess\(/)
 for(const source of [post,patch]){assert.match(source,/request\.text\(\)/);assert.match(source,/TextEncoder\(\)/)}
 assert.match(post,/\.from\("events"\)/)
 assert.match(post,/event_not_found/)
})
