import {useEffect,useState,type FormEvent} from "react"
import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownProfile,type Profile as BasicProfile} from "../lib/operational-reads"
import {ownPrivateProfile,ownWorkplacePreferences,saveOwnProfile,signedOwnPhoto,
 type PrivateDetails,type WorkplaceOption} from "../lib/profile-editor"
import {useLocale} from "../lib/use-locale"
import {writesAvailable} from "../lib/operational-mutations"
import {Refresh,WhenLoading} from "../components/data-ui"

type Bundle={basic:BasicProfile;details:PrivateDetails;preferred:string|null;options:WorkplaceOption[]}
type Feedback="saved"|"failed"|"partial"|"uncertain"|null
function Editor({uid,data,admin,refresh,onFeedback}:{uid:string;data:Bundle;admin:boolean;refresh:()=>void;onFeedback:(feedback:Feedback)=>void}){
 const {t}=useLocale()
 const [busy,setBusy]=useState(false)
 const [photoUrl,setPhotoUrl]=useState<string|null>(null)
 useEffect(()=>{
  let active=true
  setPhotoUrl(null)
  if(data.details.profile_photo_url)
   void signedOwnPhoto(data.details.profile_photo_url).then(url=>{if(active)setPhotoUrl(url)}).catch(()=>{})
  return()=>{active=false}
 },[data.details.profile_photo_url])
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(busy||!writesAvailable())return
  const fd=new FormData(event.currentTarget)
  const val=(key:string)=>String(fd.get(key)||"").trim()
  const file=fd.get("photo")
  const upload=file instanceof File&&file.size>0?file:null
  setBusy(true);onFeedback(null)
  try{
   await saveOwnProfile(uid,{
    fullName:val("name"),phone:val("phone"),dateOfBirth:val("dob"),
    address:val("address"),nationalRegister:val("national_register"),
    iban:val("iban"),preferredWorkplace:val("preferred_workplace"),
    preferredOptions:data.options,isAdmin:admin
   },upload,Boolean(data.details.profile_photo_url))
   onFeedback("saved")
   refresh()
  }catch(e){
   const code=e instanceof Error?e.message:""
   if(code==="profile_partially_saved"||code==="profile_write_uncertain"){
    onFeedback(code==="profile_partially_saved"?"partial":"uncertain")
    refresh()
   }else onFeedback("failed")
  }finally{setBusy(false)}
 }
 return <form className="card" onSubmit={event=>void submit(event)}>
  <h2>{t.profileEdit}</h2>
  <p className="muted">{t.profilePrivacy}</p>
  {photoUrl&&<img src={photoUrl} alt={t.profilePhoto} loading="lazy" style={{maxHeight:220,maxWidth:"100%",objectFit:"contain"}}/>}
  <label>{t.profileName}<input name="name" required maxLength={200} defaultValue={data.details.full_name||""}/></label>
  <label>{t.profilePhone}<input type="tel" name="phone" required maxLength={40} defaultValue={data.details.phone_number||""}/></label>
  <label>{t.profileDob}<input type="date" name="dob" required defaultValue={data.details.date_of_birth||""}/></label>
  {!admin&&<>
   <label>{t.profileAddress}<input name="address" required maxLength={500} defaultValue={data.details.home_address||""}/></label>
   <label>{t.profileNationalRegister}<input name="national_register" required maxLength={32} autoComplete="off" defaultValue={data.details.national_register_number||""}/></label>
   <label>{t.profileIban}<input name="iban" required maxLength={34} autoComplete="off" defaultValue={data.details.iban||""}/></label>
   <label>{t.profilePreferredWorkplace}<select name="preferred_workplace" required defaultValue={data.preferred||""}>
    <option value="" disabled>{t.profileChooseWorkplace}</option>
    {data.options.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
   </select></label>
  </>}
  <label>{t.profilePhoto}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"
   required={!data.details.profile_photo_url}/></label>
  <p className="muted">{t.profilePhotoRules}</p>
  <button type="submit" className="primary" disabled={busy}>{busy?t.saving:t.profileSave}</button>
 </form>
}
export default function Profile(){
 const {identity}=useSession()
 const uid=identity!.id
 const admin=identity!.role==="admin"
 const {t}=useLocale()
 const [feedback,setFeedback]=useState<Feedback>(null)
 const r=usePrivateQuery<Bundle>(uid,"my-profile",async signal=>{
  // Bounded calls occur only when this screen mounts, never in shell bootstrap.
  // Sensitive national ID/IBAN stay in ephemeral React memory, not IndexedDB.
  const [basic,details]=await Promise.all([ownProfile(uid,signal),ownPrivateProfile(uid,signal)])
  if(!basic)throw new Error("profile_unavailable")
  const preference=admin?{preferred:null,options:[] as WorkplaceOption[]}:
   await ownWorkplacePreferences(signal)
  return {basic,details,preferred:preference.preferred,options:preference.options}
 })
 return <><div className="row"><h1>{t.profile}</h1><Refresh onClick={r.refresh}/></div>
  {feedback&&<p role={feedback==="saved"?"status":"alert"} className={feedback==="saved"?"notice":"error"}>
   {feedback==="saved"?t.profileSaved:feedback==="partial"?t.profilePartialError:
    feedback==="uncertain"?t.profileUncertainError:t.profileSaveError}</p>}
  <WhenLoading loading={r.loading} error={r.error}>
   {r.data&&<><section className="card">
    <h2>{r.data.details.full_name||"—"}</h2>
    <p className="muted">{r.data.details.email||"—"}</p>
    <p>{r.data.basic.app_profile_completed_at?t.profileCompleted:t.profileIncomplete}</p>
   </section>
   {writesAvailable()?<Editor key={uid+":"+String(r.data.basic.app_profile_completed_at||"pending")}
    uid={uid} data={r.data} admin={admin} refresh={r.refresh} onFeedback={setFeedback}/>:
    <p className="muted">{t.profileReadOnly}</p>}</>}
  </WhenLoading>
 </>
}
