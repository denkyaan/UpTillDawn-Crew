import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {createHash} from "node:crypto"

// Exact existing Main login markup and behavior is the baseline.
// Changing these files requires an explicit user-approved visual/behavior change,
// never an incidental runtime migration edit.
const baseline = {
 "components/auth/login-form.tsx":"f200bec9bb2928f0a412a9f9d494af2bb40614bb",
 "app/(auth)/login/page.tsx":"f51da94a140c71889bfc9b1e7ff5df31b8f099a8",
 "app/(auth)/login/[portal]/page.tsx":"1778597f285f0f1b43bdecc6ba6454b6e9bd359b",
 "app/(auth)/login/admin/page.tsx":"ae74ccca116a733cc2a969c280fc587d4f9b1d7a",
 "app/(auth)/login/administration/page.tsx":"34e789cc0cf5b4a1224a27c55e271c3d8e9dc66d",
 "app/(auth)/login/promotion/page.tsx":"6ee0b183db83ca3a52cf796e3d5b38c887bcf3a0",
 "components/language-switcher.tsx":"8818bd8ba7dc5b1308624708b740259872e5c5b8",
 "app/(auth)/layout.tsx":"b85bd20fb85724914458c5ea8dbcf1f28b7ce64f",
 "public/uptilldawn-logo.jpeg":"0370c44285b7ba047397a481ecb29fb2f925a328"
}
const read=path=>readFileSync(path,"utf8")
function gitBlobSha(path){
 const bytes=readFileSync(path)
 return createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex")
}
test("every existing Main login source and original logo remains byte-for-byte unchanged",()=>{
 for(const [path,expected] of Object.entries(baseline))
  assert.equal(gitBlobSha(path),expected,"Unauthorized login UI or behavior change: "+path)
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
