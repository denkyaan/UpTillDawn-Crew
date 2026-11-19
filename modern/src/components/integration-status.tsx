import {useState} from "react"
import {protectedCandidateGet} from "../lib/owner-api"

type Provider="weeztix"|"sumup"|"peppol"|"banking"|"documenso"
type Status={configured:{provider:Provider;updatedAt:string|null}[];connectionFlow:string}
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
     <span>{hit?"Geregistreerde verbinding":"Niet verbonden"}</span></div>
    {hit&&<p className="muted">Laatst bijgewerkt: {hit.updatedAt||"Onbekend"}</p>}
   </li>
  })}</ul>}
  <p className="muted">Opnieuw aanmelden bij de aanbieder moet via een volledig beveiligde OAuth-stroom gebeuren. Die stroom is nog niet overgezet; er wordt hier geen onveilige handmatige sleutel-invoer aangeboden.</p>
 </section>
}
