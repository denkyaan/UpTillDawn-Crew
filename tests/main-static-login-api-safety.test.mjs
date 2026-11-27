import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')
test('public static login fetches same-origin POST API rather than Server Action on static URL',()=>{
 const src=read('components/auth/login-form.tsx')
 assert.match(src,/fetch\('\/api\/auth\/portal-login',\{/)
 assert.match(src,/method:'POST'/)
 assert.match(src,/credentials:'same-origin'/)
 assert.match(src,/body:formData/)
 assert.doesNotMatch(src,/await signIn\(formData\)/)
 assert.match(src,/method="post"/)
 assert.match(src,/data-login-hydrated=\{hydrated \? "true" : "false"\}/)
})
test('API authenticates only real same-origin form POSTs and reuses established signIn authorization',()=>{
 const api=read('app/api/auth/portal-login/route.ts')
 const auth=read('lib/actions/auth.ts')
 assert.match(api,/authRequestOrigin\(request,process\.env\.NEXT_PUBLIC_APP_URL\)/)
 const originGuard=read('lib/request-origin.ts')
 assert.match(originGuard,/site&&site!=='same-origin'/)
 assert.match(originGuard,/requestHasSameOrigin\(request\)/)
 assert.match(originGuard,/origin===configured\.origin/)
 assert.ok(api.indexOf('authRequestOrigin(request,process.env.NEXT_PUBLIC_APP_URL)')<api.indexOf('await signIn(form)'))
 assert.match(api,/startsWith\('multipart\/form-data;'\)/)
 assert.match(api,/length>16_384/)
 assert.match(api,/\['staff','responsible','promotion','administration','admin'\]/)
 assert.match(api,/await signIn\(form\)/)
 // Guard against actual code calling privileged APIs, not against comments
 // explaining why those APIs are intentionally absent.
 const executableApi=api.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'')
 assert.doesNotMatch(executableApi,/service_role|SUPABASE_SERVICE_ROLE|signInWithPassword|upt_set_admin_role_mode/)
 assert.match(auth,/await supabase\.auth\.signInWithPassword/)
 assert.match(auth,/upt_current_is_owner/)
 assert.match(auth,/upt_my_portal_assignments/)
 assert.match(auth,/sendSecurityLoginEmail/)
})
test('only Main deploy publishes static login, production remains untouched',()=>{
 const main=read('.github/workflows/deploy-main.yml')
 const production=read('.github/workflows/deploy-cloudflare.yml')
 assert.match(main,/Publish only public, pre-rendered login GET shells/)
 assert.match(main,/Verify public Main login GET shells bypass Next SSR/)
 assert.match(main,/node scripts\/publish-main-login-assets\.mjs/)
 assert.doesNotMatch(production,/publish-main-login-assets/)
})
