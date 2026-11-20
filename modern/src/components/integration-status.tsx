import {useState} from "react"
import {protectedCandidateGet,protectedCandidatePost} from "../lib/owner-api"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"
import {useLocale} from "../lib/use-locale"
import {providerCopy} from "../shared/oauth-i18n"

type Provider="weeztix"|"sumup"|"peppol"|"banking"|"documenso"
type Status={configured:{provider:Provider;updatedAt:string|null}[];connectionFlow:string;oauthReady?:{sumup:boolean;peppol:boolean}}
const description:Record<Provider,string>={
 weeztix:"Weeztix · inkom en ticketcontrole",
 sumup:"SumUp · verkoopbetalingen",
 peppol:"Peppol / Billit · facturatie",
 banking:"Ponto · bankkoppeling",
 documenso:"Documenso · contractondertekening",
}
// One functional home per provider; no duplicate settings directory.
const workspace:Record<"ticketing"|"contracts"|"invoices"|"banking"|"sales",Provider[]>={
 ticketing:["weeztix"],contracts:["documenso"],invoices:["peppol"],
 banking:["banking","sumup"],sales:["sumup"]
}
export default function IntegrationStatus({area}:{area:keyof typeof workspace}){
 const [state,setState]=useState<Status|null>(null)
 const [error,setError]=useState("")
 const [loading,setLoading]=useState(false)
 const [starting,setStarting]=useState<Provider|null>(null)
 const {locale}=useLocale(),t=providerCopy(locale)
 async function login(provider:"sumup"|"peppol"){
  if(starting||!MIGRATION_WRITES_ENABLED||!state?.oauthReady?.[provider])return
  setStarting(provider);setError("")
  try{
   const result=await protectedCandidatePost<{authorizeUrl:string}>("/api/v1/integrations/oauth/start",{provider})
   const redirect=new URL(result.authorizeUrl)
   const allowed=provider==="sumup"?redirect.origin==="https://api.sumup.com":
    ["https://my.sandbox.billit.be","https://my.billit.be"].includes(redirect.origin)
   if(!allowed||redirect.protocol!=="https:"||!redirect.searchParams.has("state"))
    throw new Error("invalid_oauth_redirect")
   window.location.assign(redirect.toString())
  }catch{setError(t.failed);setStarting(null)}
 }

 async function load(){
  if(loading)return
  setLoading(true);setError("");setState(null)
  try{setState(await protectedCandidateGet<Status>("/api/v1/integrations/status"))}
  catch(e){setError(e instanceof Error&&e.message==="access_denied"?
    "Alleen de hoofdbeheerder of bevoegde administratie kan dit zien.":
    "Verbindingsstatus is niet beschikbaar. Er wordt geen verbinding verondersteld.")}
  finally{setLoading(false)}
 }
 return <section className="card" aria-label="Externe dienststatus">
  <div className="row"><h2>Externe diensten</h2>
   <button disabled={loading} onClick={()=>void load()}>
    {loading?"Controleren…":"Controleer verbindingen"}</button></div>
  <p className="muted">Alleen actuele, beveiligde verbindingsmetadata. Geen API-sleutels of tokens in deze appweergave.</p>
  {error&&<p role="alert" className="error">{error}</p>}
  {state&&<ul className="list">{workspace[area].map(provider=>{
   const hit=state.configured.find(row=>row.provider===provider)
   return <li key={provider}>
    <div className="row"><strong>{description[provider]}</strong>
     <span>{hit?t.connected:t.disconnected}</span></div>
    {hit&&<p className="muted">Laatst bijgewerkt: {hit.updatedAt||"Onbekend"}</p>}
    {(provider==="sumup"||provider==="peppol")&&<div>
     {MIGRATION_WRITES_ENABLED&&state.oauthReady?.[provider]?
      <button type="button" disabled={starting!==null} onClick={()=>void login(provider)}>
       {starting===provider?t.connecting:t.connect}
      </button>:
      <p className="muted">{t.notReady}</p>}
    </div>}
   </li>
  })}</ul>}
  <p className="muted">{t.summary} De andere aanbieders vereisen afzonderlijke beveiligde koppelingen en blijven hier alleen-lezen.</p>
 </section>
}
