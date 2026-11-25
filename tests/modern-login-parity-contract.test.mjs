import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=path=>readFileSync(path,"utf8")

test("original Main portal selection retains all visible login choices",()=>{
 const chooser=read("app/(auth)/login/page.tsx")
 for(const fragment of [
  'href: \'/login/staff\'','href: \'/login/promotion\'',
  'href: \'/login/administration\'','href="/signup"',
  'src="/uptilldawn-logo.jpeg"','<LanguageSwitcher dark />',
 ]) assert.ok(chooser.includes(fragment),"Legacy chooser changed: "+fragment)
})
test("existing five-role login shell is the required UI baseline",()=>{
 const form=read("components/auth/login-form.tsx")
 for(const fragment of [
  'staff: { label: "Personeel"','responsible: { label: "Verantwoordelijke"',
  'admin: { label: "Beheerder"','promotion: { label: "Promotie"',
  'administration: { label: "Administratie"',
  'src="/uptilldawn-logo.jpeg"','name="portal"','name="email"',
  'name="password"','"Toon wachtwoord"','"Verberg wachtwoord"',
  'href="/forgot-password"','href="/signup"','<LanguageSwitcher dark />',
  "signInFromStaticShell(formData)",'data-login-error-code=',
 ]) assert.ok(form.includes(fragment),"Legacy login changed: "+fragment)
 const action=read("lib/actions/auth.ts")
 for(const fragment of [
  "upt_set_admin_role_mode","sendSecurityLoginEmail",
  "upt_admin_login_success","assignedPortalAccess",
  "requestedPortal === 'administration'","requestedPortal === 'promotion'",
  "'wrong_portal'","/pending-approval",
 ]) assert.ok(action.includes(fragment),"Legacy sign-in security contract changed: "+fragment)
})
test("legacy login remains the only public Main entry until screenshot AND auth parity verified",()=>{
 const main=read("app/(app)/page.tsx")
 assert.ok(!main.includes("modernMainCopy"))
 assert.ok(!main.includes('href="/modern"'))
 const routes=read("modern/src/main.tsx")
 assert.ok(routes.includes("'/login'"))
 const harness=read("modern/tests/login-parity-qa.mjs")
 for(const fragment of [
  'https://uptilldawn-main.uptilldawn.workers.dev',
  'https://uptilldawn-modern-main.uptilldawn.workers.dev',
  '"/login/staff"','"/login/responsible"','"/login/admin"',
  '"/login/promotion"','"/login/administration"',
  '"nl","fr","en","de"','"desktop"','"mobile"',
  "pixels.equals(modern.pixels)","comparisons!==48","interactionComparisons!==160",
  "stableLoginScreenshot","pixelTolerance:0","LOGIN_UNSTABLE_RENDER",
  "Login".toUpperCase().replace("LOGIN","LOGIN_PIXEL_PARITY_FAILED"),
 ]) assert.ok(harness.includes(fragment),"Login parity gate missing: "+fragment)
 assert.ok(!harness.includes("signInWithPassword"))
 assert.ok(!harness.includes("E2E_MAIN_QA_PASSWORD"))
 const gate=read("modern/scripts/login-cutover-gate.mjs")
 assert.ok(gate.includes("process.exitCode=1"))
 assert.ok(gate.includes("securityNotifications"))
 assert.ok(gate.includes("adminLoginAudit"))
 assert.ok(gate.includes("roleSwitch"))
 assert.ok(JSON.parse(read("modern/package.json")).scripts["login:visual-parity"])
 assert.ok(JSON.parse(read("modern/package.json")).scripts["login:cutover-gate"])
})
