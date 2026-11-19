import {useState} from "react"
import {Link} from "react-router-dom"
import {requestOwnQr,type QrResult} from "../lib/transactional-operations"
import {MIGRATION_WRITES_ENABLED} from "../lib/operational-writes"

export default function QrWorkflow(){
 const [result,setResult]=useState<QrResult|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [reason,setReason]=useState("")
 async function request(options?:{contactConfirmed?:boolean;remote?:boolean;earlyReason?:string}){
  if(busy||!MIGRATION_WRITES_ENABLED)return
  setBusy(true);setError("")
  try{setResult(await requestOwnQr(options))}
  catch{setError("QR-aanvraag kon niet worden bevestigd. Geen start- of stoptijd geregistreerd.")}
  finally{setBusy(false)}
 }
 return <><h1>QR · start, stop en goedkeuring</h1>
  <section className="card">
   <p>Deze aanvraag wordt uitsluitend door de bestaande QR-databaseworkflow verwerkt. Een ingediende aanvraag is <strong>geen goedgekeurde check-in</strong>.</p>
   {!MIGRATION_WRITES_ENABLED?<p className="notice">QR-transacties zijn op deze migratiekandidaat nog niet geactiveerd. De bestaande app blijft vereist.</p>
    :<button className="primary" disabled={busy} onClick={()=>void request()}>{busy?"Controle loopt…":"Start QR-aanvraag"}</button>}
   {error&&<p className="error" role="alert">{error}</p>}
   {result&&<div role="status" aria-live="polite">
    {result.action==="outside_window"&&<p>Er is momenteel geen shift binnen het startvenster. Volgende dienst: {result.nextStart||"Onbekend"}.</p>}
    {result.action==="pending"&&<p>Je {result.kind==="stop"?"stop":"start"}aanvraag wacht op goedkeuring. Geen uren worden als goedgekeurd voorgesteld.</p>}
    {result.action==="requested"&&<p>Aanvraag ontvangen door het systeem. Goedkeuring door {result.reviewer||"de verantwoordelijke"} is nog nodig.</p>}
    {result.action==="confirm_required"&&<><p>Bevestig eerst de vereiste shifts en briefings.</p>
     <ul>{result.items.map(item=><li key={item.id}>{item.title}</li>)}</ul>
     <Link to={result.kind==="shift"?"/crew":"/briefings"}>Ga naar vereiste bevestigingen</Link>
    </>}
    {result.action==="early_reason_required"&&<div><label>Reden van vroegtijdig starten
     <textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
     <button className="primary" disabled={busy||reason.trim().length<3}
      onClick={()=>void request({earlyReason:reason})}>Reden indienen voor beoordeling</button></div>}
    {result.action==="contact"&&<><p>Heb je de verantwoordelijke gecontacteerd?</p>
     <div className="row"><button disabled={busy} onClick={()=>void request({contactConfirmed:true})}>Ja</button>
      <button disabled={busy} onClick={()=>void request({contactConfirmed:false})}>Nee</button></div></>}
    {result.action==="remote_required"&&<><p>Een aanvraag op afstand wordt door {result.reviewer||"de beheerder"} beoordeeld. Dit vervangt geen identiteits- of selfiecontrole.</p>
     <button className="primary" disabled={busy} onClick={()=>void request({remote:true})}>Aanvraag ter beoordeling indienen</button></>}
   </div>}
  </section>
  <p className="muted">De volledige fysieke QR-/GPS-/selfieverificatie is nog niet opnieuw bewezen. Daarom blijft dit onderdeel geblokkeerd voor eindgebruikers tot acceptatietesten.</p>
 </>
}
