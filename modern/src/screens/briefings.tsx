import {useState} from "react"
import {useSession} from "../lib/session"
import {supabase} from "../lib/supabase"
import {allowedBriefings,ownAcknowledgements,type Briefing,type Acknowledgement} from "../lib/operational-reads"
import {usePrivateQuery} from "../lib/use-private-query"
import {acknowledgeOwnBriefing,writesAvailable} from "../lib/operational-mutations"
import {DataList,Refresh,Timestamp,WhenLoading} from "../components/data-ui"

type Bundle={briefings:Briefing[];acknowledgements:Acknowledgement[]}
export default function Briefings(){
 const uid=useSession().identity!.id
 const r=usePrivateQuery<Bundle>(uid,"briefings",async signal=>{
  const [briefings,acknowledgements]=await Promise.all([
   allowedBriefings(signal),ownAcknowledgements(uid,signal),
  ])
  return {briefings,acknowledgements}
 })
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState(false)
 async function acknowledge(id:string){
  if(!writesAvailable()||busy)return
  setBusy(id);setError(false)
  try{await acknowledgeOwnBriefing(id);r.refresh()}catch{setError(true)}
  finally{setBusy(null)}
 }
 const versions=new Map((r.data?.acknowledgements||[]).map(item=>[item.briefing_id,item.version]))
 return <><div className="row"><h1>Evenementbriefings</h1><Refresh onClick={r.refresh}/></div>
 {error&&<p className="error" role="alert">Bevestiging afgewezen of verbinding onderbroken. Probeer opnieuw.</p>}
 <WhenLoading loading={r.loading} error={r.error}>
  <DataList empty={!r.data?.briefings.length}>{r.data?.briefings.map(brief=><li key={brief.id}>
   <h2>{brief.title}</h2>
   <p className="muted">Versie {brief.version} · Bijgewerkt <Timestamp value={brief.updated_at}/>{brief.required?" · verplicht":""}</p>
   <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{brief.body}</p>
   {versions.get(brief.id)===brief.version?<p>Bevestigd</p>
    :writesAvailable()?<button className="primary" disabled={busy!==null} onClick={()=>void acknowledge(brief.id)}>Gelezen en begrepen</button>
    :<p className="muted">Bevestigen nog uitgeschakeld tijdens de migratie.</p>}
  </li>)}</DataList>
 </WhenLoading></>
}
