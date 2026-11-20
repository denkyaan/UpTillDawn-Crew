import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(file)=>readFileSync(file,'utf8')

test('Cloudflare retains static login assets without intercepting dynamic authenticated SSR',()=>{
 const config=read('open-next.config.ts')
 assert.match(config,/incrementalCache:\s*staticAssetsIncrementalCache/)
 assert.match(config,/enableCacheInterception:\s*false/)
 assert.match(config,/static-assets-incremental-cache/)
 const wrangler=JSON.parse(read('wrangler.main.jsonc'))
 assert.equal(wrangler.name,'uptilldawn-main')
 assert.equal(wrangler.assets.binding,'ASSETS')
 assert.notEqual(wrangler.assets.run_worker_first,true,'static assets must bypass Worker when matched')
 const publicStatic=[
  'app/(auth)/login/administration/page.tsx',
  'app/(auth)/login/promotion/page.tsx',
  'app/(auth)/login/[portal]/page.tsx',
 ]
 for(const path of publicStatic){
  const page=read(path)
  assert.match(page,/export const dynamic = 'force-static'/)
  assert.doesNotMatch(page,/getCurrentUser\(|cookies\(|headers\(/)
 }
 const protectedDynamic=[
  'app/(app)/admin/page.tsx',
  'app/(app)/events/page.tsx',
  'app/(app)/chat/page.tsx',
  'app/(app)/portals/administration/page.tsx',
  'app/(app)/portals/administration/finance/page.tsx',
 ]
 for(const path of protectedDynamic){
  assert.match(read(path),/export const dynamic\s*=\s*['"]force-dynamic['"]/,path+' must not be served from a read-only public cache')
 }
 assert.match(read('app/(app)/layout.tsx'),/getCurrentUser\(\)/)
 assert.match(read('lib/supabase/middleware.ts'),/await supabase.auth.getClaims\(\)/)
})
