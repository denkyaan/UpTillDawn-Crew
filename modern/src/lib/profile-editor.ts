import {supabase} from "./supabase"
import {verifyOwnSession,MIGRATION_WRITES_ENABLED} from "./operational-writes"
import {validateProfileInput,validPhotoSignature,type ProfileInput} from "../shared/profile-validation"

export type PrivateDetails={id:string;email:string|null;full_name:string|null;phone_number:string|null;
 home_address:string|null;date_of_birth:string|null;national_register_number:string|null;
 iban:string|null;profile_photo_url:string|null}
export type WorkplaceOption={id:string;name:string}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function ownPrivateProfile(uid:string,signal:AbortSignal):Promise<PrivateDetails>{
 const {data,error}=await supabase().rpc("upt_own_profile_details").abortSignal(signal)
 const row=Array.isArray(data)&&data.length===1?data[0] as PrivateDetails:null
 if(error||!row||row.id!==uid)throw new Error("profile_private_unavailable")
 return row
}
export async function ownWorkplacePreferences(signal:AbortSignal):Promise<{preferred:string|null;options:WorkplaceOption[]}>{
 // Access to options and the existing choice is enforced by the server.
 // Only load after opening the profile editor (never on every navigation).
 const db=supabase()
 const [{data:pref,error:prefError},{data:options,error:optionError}]=await Promise.all([
  db.rpc("upt_own_workplace_preference").abortSignal(signal),
  db.rpc("upt_profile_workplace_options").abortSignal(signal),
 ])
 if(prefError||optionError||!Array.isArray(options))throw new Error("workplace_preference_unavailable")
 const filtered=options.slice(0,200).filter((row:unknown):row is WorkplaceOption=>
  Boolean(row)&&typeof row==="object"&&UUID.test(String((row as WorkplaceOption).id))
  &&typeof (row as WorkplaceOption).name==="string")
 const preferred=typeof pref==="string"&&UUID.test(pref)?pref:null
 return {preferred,options:filtered}
}
export async function signedOwnPhoto(path:string):Promise<string|null>{
 if(!path)return null
 const {data,error}=await supabase().storage.from("profile-photos").createSignedUrl(path,180)
 return error?null:data?.signedUrl||null
}
export type SaveOwnProfileInput=Omit<ProfileInput,"hasPhoto">&{preferredOptions:readonly WorkplaceOption[]}
export async function saveOwnProfile(uid:string,input:SaveOwnProfileInput,photo:File|null,hasExistingPhoto:boolean){
 if(!MIGRATION_WRITES_ENABLED)throw new Error("migration_writes_not_enabled")
 if(photo){
  if(photo.size===0||photo.size>5*1024*1024)throw new Error("photo_too_large")
  if(!["image/jpeg","image/png","image/webp"].includes(photo.type))throw new Error("invalid_photo_type")
  const bytes=new Uint8Array(await photo.slice(0,24).arrayBuffer())
  if(!validPhotoSignature(photo.type,bytes))throw new Error("invalid_photo_signature")
 }
 const clean=validateProfileInput({...input,hasPhoto:hasExistingPhoto||Boolean(photo)})
 if(!input.isAdmin&&!input.preferredOptions.some(x=>x.id===clean.preferredWorkplace))
  throw new Error("invalid_workplace_preference")
 const ownId=await verifyOwnSession()
 if(ownId!==uid)throw new Error("profile_identity_changed")
 const db=supabase()
 let uploadedPath:string|null=null
 let profileCommitted=false
 try{
  if(photo){
   const extension=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg"
   uploadedPath=uid+"/"+crypto.randomUUID()+"."+extension
   const {error}=await db.storage.from("profile-photos").upload(uploadedPath,photo,{
    contentType:photo.type,upsert:false
   })
   if(error)throw new Error("photo_upload_failed")
  }
  const {error}=await db.rpc("upt_update_own_profile",{
   p_full_name:clean.fullName,
   p_phone_number:clean.phone,
   p_date_of_birth:clean.dateOfBirth,
   p_home_address:input.isAdmin?undefined:clean.address,
   p_national_register_number:input.isAdmin?undefined:clean.nationalRegister,
   p_iban:input.isAdmin?undefined:clean.iban,
   // Passing NULL preserves the existing path in the audited server RPC.
   p_profile_photo_path:uploadedPath||undefined
  })
  if(error)throw new Error("profile_update_rejected")
  profileCommitted=true
  if(!input.isAdmin){
   const {error:preferenceError}=await db.rpc("upt_set_own_workplace_preference",{
    p_workplace:clean.preferredWorkplace
   })
   if(preferenceError)throw new Error("profile_preference_rejected")
  }
  const {data:completion,error:completionError}=await db.rpc("upt_current_profile_completion")
  if(completionError||!Array.isArray(completion)||completion.length!==1)
   throw new Error("profile_completion_unavailable")
  if(completion[0].required===true&&completion[0].completed===false){
   const {data:ok,error:markError}=await db.rpc("upt_mark_own_profile_complete")
   if(markError||ok!==true)throw new Error("profile_completion_rejected")
  }
  // Never remove the previous photo in the migration candidate: other user
  // records may still reference it and cleanup is not part of this transaction.
 }catch(error){
  if(uploadedPath&&!profileCommitted){
   await db.storage.from("profile-photos").remove([uploadedPath]).catch(()=>{})
  }
  // If the profile RPC succeeded, the new photo is LIVE. Removing it on any
  // later preference/completion error would corrupt the committed profile.
  if(profileCommitted)throw new Error("profile_partially_saved")
  throw error
 }
}
