import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {validateProfileInput,normalizedIban,validIban,validPhotoSignature} from "../src/shared/profile-validation.ts"
import {copy,languages} from "../src/shared/i18n.ts"
const id="12345678-1234-4234-8234-123456789012"
const fields={fullName:"Jane Smith",phone:"+32475123456",dateOfBirth:"1999-06-15",
 address:"Lange straat 2, Leuven",nationalRegister:"99111512345",
 iban:"BE68 5390 0754 7034",preferredWorkplace:id,hasPhoto:true,isAdmin:false}
test("valid self profile accepts normalized known-valid Belgian IBAN and user roles",()=>{
 const result=validateProfileInput(fields,new Date("2026-11-19T11:00:00Z"))
 assert.equal(result.iban,"BE68539007547034")
 assert.equal(normalizedIban(fields.iban),result.iban)
 assert.equal(validIban("BE68 5390 0754 7034"),true)
 assert.equal(validIban("BE68 5390 0754 7035"),false)
 assert.equal(result.preferredWorkplace,id)
 const admin=validateProfileInput({...fields,isAdmin:true,address:"",nationalRegister:"",iban:"",preferredWorkplace:""},new Date("2026-11-19T11:00:00Z"))
 assert.equal(admin.iban,"")
 assert.equal(admin.preferredWorkplace,null)
})
test("invalid DOB, IBAN, mandatory fields and missing photo are rejected before upload",()=>{
 const now=new Date("2026-11-19T11:00:00Z")
 for(const field of [
  {fullName:"Single"}, {phone:" "},{dateOfBirth:"2027-01-01"},{dateOfBirth:"2026-02-30"},
  {dateOfBirth:"1880-01-01"},{address:""},{nationalRegister:""},
  {iban:"BE68539007547035"},{preferredWorkplace:"/events"},{hasPhoto:false}
 ])assert.throws(()=>validateProfileInput({...fields,...field},now))
})
test("photo headers must match upload MIME and reject SVG disguised as PNG",()=>{
 assert.equal(validPhotoSignature("image/jpeg",new Uint8Array([255,216,255,0])),true)
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,0,0,0,0,0])
 assert.equal(validPhotoSignature("image/png",png),true)
 assert.equal(validPhotoSignature("image/webp",new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,0,0,0,0])),true)
 assert.equal(validPhotoSignature("image/png",new Uint8Array([60,115,118,103,62])),false)
 assert.equal(validPhotoSignature("image/svg+xml",png),false)
})
test("private profile uses signed self-only RPCs, validates live identity, never caches secrets",()=>{
 const editor=readFileSync(new URL("../src/lib/profile-editor.ts",import.meta.url),"utf8")
 const profile=readFileSync(new URL("../src/screens/profile.tsx",import.meta.url),"utf8")
 const expected=["upt_own_profile_details","upt_profile_workplace_options","upt_own_workplace_preference",
 "upt_update_own_profile","upt_set_own_workplace_preference","upt_current_profile_completion","upt_mark_own_profile_complete"]
 for(const name of expected)assert.ok(editor.includes('.rpc("'+name+'"'),name)
 assert.ok(editor.includes("row.id!==uid"))
 assert.ok(editor.includes("await verifyOwnSession()"))
 assert.ok(editor.includes("if(ownId!==uid)"))
 assert.ok(editor.includes("if(uploadedPath&&!profileRpcStarted)"))
 assert.ok(editor.includes("if(profileRpcStarted)throw new Error(\"profile_write_uncertain\")"))
 assert.ok(editor.includes('throw new Error("profile_partially_saved")'))
 for(const banned of ["indexedDB","localStorage","sessionStorage","service_role","profiles\").update("])
  assert.ok(!editor.includes(banned),banned)
 assert.ok(profile.includes("ownProfile(uid,signal)"))
 assert.ok(profile.includes("usePrivateQuery<Bundle>"))
 assert.ok(profile.includes("writesAvailable()?"))
 assert.ok(profile.includes("onFeedback={setFeedback}"))
 assert.ok(profile.includes("feedback===\"uncertain\"?t.profileUncertainError"))
})
test("profile editing and privacy notices exist in all supported languages",()=>{
 for(const locale of languages){
  const t=copy(locale)
  for(const key of ["profileEdit","profilePrivacy","profileName","profilePhone","profileDob","profileAddress",
   "profileNationalRegister","profileIban","profilePreferredWorkplace","profileChooseWorkplace","profilePhoto",
   "profilePhotoRules","profileSaved","profileSave","profileSaveError","profilePartialError","profileUncertainError","profileReadOnly",
   "profileCompleted","profileIncomplete"])
   assert.ok(t[key].trim().length>=2,locale+":"+key)
 }
})
