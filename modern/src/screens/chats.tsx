import {useSession} from "../lib/session"
import {loadChatList} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {copy,deviceLocale} from "../shared/i18n"

export default function Chats(){
 const {identity}=useSession(),t=copy(deviceLocale())
 const result=useRead(identity!.id,"chat-list",loadChatList)
 return <><div className="row"><h1>{t.chat}</h1><button className="primary" onClick={result.refresh}>{t.refresh}</button></div>
 {result.stale&&<p className="notice" role="status">{t.offline}</p>}
 {result.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {result.loading&&<p role="status">{t.loading}</p>}
 {!result.loading&&result.data?.length===0&&<p>{t.noData}</p>}
 <ul className="list">{result.data?.map(channel=><li key={channel.id} className="row"><strong>{channel.name}</strong><span className="muted">{channel.kind}</span></li>)}</ul>
 <p className="muted">Message sending, read receipts, workpost channels and translations remain in the existing chat until full parity.</p></>
}
