import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {createHash} from "node:crypto"

// Protect Main login source and behavior against incidental runtime migration edits.
// The user's explicit 2026-11-22 request now covers the portal chooser AND
// all five role-specific login forms: full-black, fixed, non-scrolling.
// Login semantics, recovery, session handling and original logo stay pinned.
const baseline = {
 "components/auth/login-form.tsx":"de9c9b26e4c61e381af18e001d7614ca5a76e303",
 "app/(auth)/login/page.tsx":"28cc96ab2b86bf123e738ab6d321a01cfaec7df0",
 "app/(auth)/login/[portal]/page.tsx":"1778597f285f0f1b43bdecc6ba6454b6e9bd359b",
 "app/(auth)/login/admin/page.tsx":"ae74ccca116a733cc2a969c280fc587d4f9b1d7a",
 "app/(auth)/login/administration/page.tsx":"34e789cc0cf5b4a1224a27c55e271c3d8e9dc66d",
 "app/(auth)/login/promotion/page.tsx":"6ee0b183db83ca3a52cf796e3d5b38c887bcf3a0",
 "components/language-switcher.tsx":"8818bd8ba7dc5b1308624708b740259872e5c5b8",
 "app/(auth)/layout.tsx":"b6dd3aa5a3df6a3a0be73bf2143842f13f2caa11",
 "public/uptilldawn-logo.jpeg":"0370c44285b7ba047397a481ecb29fb2f925a328"
}
const read=path=>readFileSync(path,"utf8")
function gitBlobSha(path){
 const bytes=readFileSync(path)
 return createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex")
}
test("approved Main login source and original logo stay byte-for-byte pinned",()=>{
 for(const [path,expected] of Object.entries(baseline))
  assert.equal(gitBlobSha(path),expected,"Unauthorized login UI or behavior change: "+path)
})
test("explicit user-approved portal chooser is fixed full black without changing other auth views",()=>{
 const chooser=read("app/(auth)/login/page.tsx")
 const layout=read("app/(auth)/layout.tsx")
 const css=read("app/globals.css")
 assert.ok(chooser.includes('data-portal-chooser="true"'))
 assert.ok(chooser.includes('className="portal-selection-screen'))
 assert.ok(chooser.includes('portal-selection-logo'))
 assert.ok(chooser.includes('portal-selection-links'))
 assert.ok(chooser.includes('portal-selection-card'))
 assert.ok(layout.includes('className="auth-layout '))
 assert.ok(layout.includes('className="auth-layout-content '))
 for(const contract of [
  "html:has(.portal-selection-screen)",
  "body:has(.portal-selection-screen)",
  ".auth-layout:has(.portal-selection-screen)",
  ".auth-layout-content:has(.portal-selection-screen)",
  ".auth-layout:has(.portal-selection-screen) > footer",
  "height: 100dvh;",
  "position: fixed;",
  "overflow: hidden;",
  "background: #000;",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)"
 ])assert.ok(css.includes(contract),"Missing scoped non-scroll layout: "+contract)
 // Portal forms deliberately share full-black viewport semantics; route-specific
 // chooser selectors must still not leak into the forms themselves.
 assert.ok(!read("components/auth/login-form.tsx").includes("portal-selection-screen"))
 assert.ok(!read("app/(auth)/login/[portal]/page.tsx").includes("portal-selection-screen"))
})

test("user-approved five portal forms are black fixed-screen and prevent document scroll",()=>{
 const login=read("components/auth/login-form.tsx")
 const css=read("app/globals.css")
 for(const cls of ["auth-portal-screen","auth-portal-content","auth-portal-logo-frame",
  "auth-portal-logo","auth-portal-card","auth-portal-heading","auth-portal-register",
  "auth-portal-language","auth-portal-menu"])assert.ok(login.includes(cls),"Missing form viewport hook "+cls)
 assert.ok(login.includes('data-auth-portal="true"'))
 for(const contract of ["html:has(.auth-portal-screen)","body:has(.auth-portal-screen)",
  ".auth-layout:has(.auth-portal-screen)",".auth-layout-content:has(.auth-portal-screen)",
  ".auth-layout:has(.auth-portal-screen) > footer","height: 100dvh;",
  "overflow: hidden;","background: #000;","auth-portal-content","auth-portal-card",
  "auth-portal-logo-frame","auth-portal-language",":focus-within",
  "env(safe-area-inset-top)","env(safe-area-inset-bottom)"])
  assert.ok(css.includes(contract),"Missing scoped fixed black login contract "+contract)
 for(const unchanged of ["signInFromStaticShell","handleSubmit","data-login-hydrated",
   'href="/forgot-password"','href="/signup"',"nativeAction","onSubmit",
   "showPassword","setMenuOpen","LanguageSwitcher dark"])
  assert.ok(login.includes(unchanged),"Login behavior must stay unchanged: "+unchanged)
 assert.ok(!read("app/(auth)/signup/page.tsx").includes("auth-portal-screen"))
})

test("original five login portals, menu, language, recovery and show-password remain present",()=>{
 const login=read("components/auth/login-form.tsx"),chooser=read("app/(auth)/login/page.tsx")
 for(const name of ["staff","responsible","admin","promotion","administration"])
  assert.ok(login.includes(name),"Missing portal "+name)
 for(const control of ["Menu","EyeOff","Eye","LanguageSwitcher","signInFromStaticShell",
  "uptilldawn-logo.jpeg","Wachtwoord vergeten?","Account aanmaken",
  "data-login-hydrated","handleSubmit"])
  assert.ok(login.includes(control),"Missing login interaction "+control)
 for(const route of ["/login/staff","/login/promotion","/login/administration"])
  assert.ok(chooser.includes(route),"Missing portal selection "+route)
})
test("modern candidate must use original logo bytes, but must NOT claim login or app parity",()=>{
 assert.deepEqual(readFileSync("modern/public/uptilldawn-logo.jpeg"),readFileSync("public/uptilldawn-logo.jpeg"))
 const inventory=read("modern/scripts/inventory.mjs")
 assert.ok(inventory.includes("migrationReady:false"))
 assert.ok(inventory.includes("productionCutoverAllowed:false"))
 assert.ok(inventory.includes("verifiedPages:0"))
 assert.ok(inventory.includes("--enforce-parity"))
 const existingMain=read("app/(app)/page.tsx")
 assert.ok(!existingMain.includes("modernMainCopy"))
 assert.ok(!existingMain.includes("uptilldawn-modern-main.uptilldawn.workers.dev"))
})
