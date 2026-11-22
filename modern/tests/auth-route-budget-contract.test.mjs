import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const originalAuth=readFileSync(new URL("../src/screens/original-auth.tsx",import.meta.url),"utf8")
const config=readFileSync(new URL("../../.github/workflows/fast-change-validation.yml",import.meta.url),"utf8")
const budget=readFileSync(new URL("../scripts/bundle-budget.mjs",import.meta.url),"utf8")
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8")

test("original five portal logins remain eagerly available and use exact Main source",()=>{
 assert.ok(originalAuth.includes('import LoginPage from "@/app/(auth)/login/page"'))
 assert.ok(originalAuth.includes('import {LoginForm} from "@/components/auth/login-form"'))
 assert.ok(originalAuth.includes('if(pathname==="/login")screen=<LoginPage/>'))
 for(const portal of ["staff","responsible","admin","promotion","administration"])
  assert.ok(originalAuth.includes('"'+portal+'"'))
 assert.ok(originalAuth.includes("screen=<LoginForm key={portal}"))
})

test("auth recovery and enrollment use exactly the original components in lazy route chunks",()=>{
 const children=[
  ["SignupPage","@/app/(auth)/signup/page",'/signup','screen=<SignupPage/>'],
  ["ResetPasswordPage","@/app/auth/reset-password/page",'/auth/reset-password','screen=<ResetPasswordPage/>'],
  ["VerifyEmailClient","@/app/(auth)/verify-email/verify-email-client",'/verify-email','screen=<VerifyEmailClient/>'],
  ["ForgotPasswordForm","@/components/auth/forgot-password-form",'/forgot-password','screen=<ForgotPasswordForm initialError=']
 ]
 for(const [component,path,route,render] of children){
  assert.ok(originalAuth.includes(component+'=lazy(()=>import("'+path+'"))'),"eager route: "+route)
  assert.ok(originalAuth.includes('pathname==="'+route+'"'),"missing route: "+route)
  assert.ok(originalAuth.includes(render),"changed source JSX: "+route)
  assert.ok(!originalAuth.includes('import '+component+' from '),"eager static import regression: "+component)
 }
 assert.ok(main.includes('<Suspense fallback={null}>')&&main.includes('<OriginalAuth/>'))
 assert.ok(originalAuth.includes("<AuthLayout>{screen}</AuthLayout>"))
})

test("all pull requests run actual identical Main-QA Vite gzip budgets before merge",()=>{
 assert.ok(config.includes("npm --prefix modern run build"))
 assert.ok(config.includes("npm --prefix modern run budget"))
 assert.ok(config.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(config.includes("VITE_MIGRATION_SCANNING_ENABLED: 'false'"))
 assert.ok(config.includes("VITE_SUPABASE_URL: https://npbjrtiolqperdgljnhi.supabase.co"))
 assert.ok(budget.includes("authRouteGzip>350*1024"))
 assert.ok(budget.includes("maxInitialGzip=128*1024"))
})
