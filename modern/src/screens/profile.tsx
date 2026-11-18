import {useSession} from "../lib/session"
import {usePrivateQuery} from "../lib/use-private-query"
import {ownProfile,type Profile} from "../lib/operational-reads"
import {Refresh,WhenLoading} from "../components/data-ui"

export default function Profile(){
 const uid=useSession().identity!.id
 const r=usePrivateQuery<Profile|null>(uid,"my-profile",signal=>ownProfile(uid,signal))
 return <><div className="row"><h1>Mijn profiel</h1><Refresh onClick={r.refresh}/></div>
 <section className="card">
 <WhenLoading loading={r.loading} error={r.error}>
  {r.data?<dl>
   <dt>Naam</dt><dd>{r.data.full_name||"—"}</dd>
   <dt>Telefoon</dt><dd>{r.data.phone_number||"—"}</dd>
   <dt>Adres</dt><dd>{r.data.home_address||"—"}</dd>
   <dt>Profiel</dt><dd>{r.data.app_profile_completed_at?"Ingevuld":"Nog aan te vullen"}</dd>
  </dl>:<p>Geen profiel zichtbaar.</p>}
 </WhenLoading></section>
 <p className="muted">Persoonlijke gegevens worden niet lokaal opgeslagen. Bewerken en verplichte velden blijven voorlopig via de bestaande profielworkflow lopen.</p>
 </>
}
