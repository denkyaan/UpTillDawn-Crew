import {useSession} from "../lib/session"
import {loadEvents,type EventRow} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {copy,deviceLocale} from "../shared/i18n"

function date(value:string){const n=Date.parse(value);return Number.isFinite(n)?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(n)):value}
function EventCard({event}:{event:EventRow}){return <article className="card"><div className="row"><h2>{event.name}</h2><span className="muted">{event.status}</span></div><p>{date(event.start_at)} – {date(event.end_at)}</p><p className="muted">{[event.venue,event.address].filter(Boolean).join(" · ")}</p></article>}
export default function Events(){
 const {identity}=useSession(),t=copy(deviceLocale())
 const result=useRead(identity!.id,"events",loadEvents)
 return <><div className="row"><h1>{t.events}</h1><button className="primary" onClick={result.refresh}>{t.refresh}</button></div>
 {result.stale&&<p className="notice" role="status">{t.offline}</p>}
 {result.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {result.loading&&<p role="status">{t.loading}</p>}
 {!result.loading&&result.data?.length===0&&<p>{t.noData}</p>}
 <div>{result.data?.map(event=><EventCard key={event.id} event={event}/>)}</div></>
}
