import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('anonymous login pages are statically renderable, not heavyweight per-request SSR',()=>{
 const publicPages=['app/(auth)/login/page.tsx','app/(auth)/login/promotion/page.tsx','app/(auth)/login/administration/page.tsx','app/(auth)/login/[portal]/page.tsx','app/(auth)/login/admin/page.tsx']
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
test('admin login uses static GET and preserves existing safe error feedback after hydration',()=>{
 const page=read('app/(auth)/login/admin/page.tsx')
 const form=read('components/auth/login-form.tsx')
 const api=read('app/api/auth/portal-login/route.ts')
 assert.match(page,/force-static/)
 assert.match(page,/<LoginForm portal="admin"/)
 assert.match(form,/queryError = useSyncExternalStore/)
 assert.ok(form.includes('new URLSearchParams(window.location.search).get("error")'))
 assert.match(form,/setInitialErrorDismissed\(true\)/)
 assert.match(form,/await signInFromStaticShell\(formData\)/)
 assert.match(api,/await signIn\(form\)/)
 assert.ok(api.includes("'administration','admin'"))
})

test('browser locale is set immediately on hydrated shell but text replacement remains deferred',()=>{
 const sync=read('components/locale-sync.tsx')
 assert.match(sync,/let locale = initialUiLocale\(\) as ExtendedUiLocale\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*document\.documentElement\.lang = locale/)
 assert.match(sync,/startRuntimeTranslation/)
 const layout=read('app/layout.tsx')
 assert.match(layout,/<Suspense fallback=\{null\}><PushPermissionPrompt \/><\/Suspense>/)
})
