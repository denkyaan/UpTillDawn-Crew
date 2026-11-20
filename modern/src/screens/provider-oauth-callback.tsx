import {useEffect,useRef,useState} from "react"
import {Link,useParams} from "react-router-dom"
import {protectedCandidatePost} from "../lib/owner-api"
import {useLocale} from "../lib/use-locale"
import {providerCopy} from "../shared/oauth-i18n"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"
type Result="pending"|"success"|"denied"|"failed"
export default function ProviderOauthCallback(){
 const {provider}=useParams()
 const {locale}=useLocale(),t=providerCopy(locale)
 const once=useRef(false)
 const [result,setResult]=useState<Result>("pending")
 useEffect(()=>{
  if(once.current)return
  once.current=true
  const params=new URLSearchParams(window.location.search)
  // Remove authorization code/state from browser history and subsequent
  // same-origin referrers before performing any network request.
  window.history.replaceState(window.history.state,"",window.location.pathname)
  if(!MIGRATION_WRITES_ENABLED||!(provider==="sumup"||provider==="peppol")){
   setResult("failed");return
  }
  if(params.has("error")){setResult("denied");return}
  const code=params.get("code")||"",state=params.get("state")||""
  if(code.length<6||code.length>2048||!/^[0-9a-f]{64}$/.test(state)){
   setResult("failed");return
  }
  void protectedCandidatePost<{connected:boolean}>("/api/v1/integrations/oauth/complete",{
   provider,code,state
  }).then(data=>setResult(data.connected===true?"success":"failed")).catch(()=>setResult("failed"))
 },[provider])
 return <section className="card" role="status">
  <h1>{result==="pending"?t.callbackWorking:result==="success"?t.callbackSuccess:
   result==="denied"?t.callbackDenied:t.callbackFailed}</h1>
  <p><Link to="/portals/administration">{t.back}</Link></p>
 </section>
}
