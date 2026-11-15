import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('anonymous login pages are statically renderable, not heavyweight per-request SSR',()=>{
 const publicPages=['app/(auth)/login/page.tsx','app/(auth)/login/promotion/page.tsx','app/(auth)/login/administration/page.tsx','app/(auth)/login/[portal]/page.tsx']
 for(const p of publicPages){
  const source=read(p)
  assert.match(source,/export const dynamic = 'force-static'/,p)
  assert.doesNotMatch(source,/getCurrentUser\(|createClient\(|cookies\(|headers\(/,p)
 }
 const rolePage=read('app/(auth)/login/[portal]/page.tsx')
 assert.match(rolePage,/generateStaticParams\(\)/)
 assert.match(rolePage,/portal: 'staff'/)
 assert.match(rolePage,/portal: 'responsible'/)
 assert.match(rolePage,/dynamicParams = false/)
})
test('admin login keeps request-bound error display and is not statically cached',()=>{
 const source=read('app/(auth)/login/admin/page.tsx')
 assert.match(source,/searchParams/)
 assert.match(source,/initialError=\{error\}/)
 assert.doesNotMatch(source,/force-static/)
})
test('browser locale is set immediately on hydrated shell but text replacement remains deferred',()=>{
 const sync=read('components/locale-sync.tsx')
 assert.match(sync,/let locale = initialUiLocale\(\) as ExtendedUiLocale\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*document\.documentElement\.lang = locale/)
 assert.match(sync,/startRuntimeTranslation/)
 const layout=read('app/layout.tsx')
 assert.match(layout,/<Suspense fallback=\{null\}><PushPermissionPrompt \/><\/Suspense>/)
})
