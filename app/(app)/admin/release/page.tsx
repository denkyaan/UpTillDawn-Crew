import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { releaseReadiness, type ReleaseCheck } from '@/lib/release-readiness'
import { EXPECTED_DB_MIGRATION_VERSION } from '@/lib/release-baseline'
import type { Database } from '@/types/crew-database'

export const dynamic='force-dynamic'

type Snapshot=Database['public']['Functions']['upt_admin_release_readiness_snapshot']['Returns'][number]

function CheckRow({check}:{check:ReleaseCheck}){
  const status=check.passed?'OK':check.required?'BLOKKEERT':'WAARSCHUWING'
  const style=check.passed
    ?'border-emerald-500/40 bg-emerald-500/5 text-emerald-700'
    :check.required
      ?'border-red-500/40 bg-red-500/5 text-red-700'
      :'border-amber-500/40 bg-amber-500/5 text-amber-700'
  return <div className={'rounded-xl border p-3 '+style}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-bold">{check.name}</p>
      <span className="rounded-full border px-2 py-1 text-xs font-black">{status}</span>
    </div>
    {check.detail&&<p className="mt-1 text-sm opacity-80">{check.detail}</p>}
  </div>
}

export default async function Page(){
  const current=await getCurrentUser()
  if(!current?.isAdmin)redirect('/')

  const s=await createClient()
  const {data,error}=await s.rpc('upt_admin_release_readiness_snapshot')
  const snapshot=data?.[0] as Snapshot|undefined

  if(error||!snapshot){
    return <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN BEHEER</p>
          <h1 className="text-3xl font-black">Release readiness</h1>
        </div>
        <Link href="/admin" className="rounded-xl border px-4 py-3 font-semibold">Beheeroverzicht</Link>
      </div>
      <section className="rounded-2xl border border-red-500/50 bg-red-500/5 p-5">
        <h2 className="text-xl font-bold text-red-700">Release geblokkeerd</h2>
        <p className="mt-2 text-sm text-muted-foreground">De server-side readiness snapshot kon niet worden geladen.</p>
      </section>
    </main>
  }

  const pendingApprovals=Number(snapshot.pending_checkins)+Number(snapshot.pending_checkouts)
  const checks:ReleaseCheck[]=[
    {
      name:'Database schema gelijk aan deze build',
      required:true,
      passed:snapshot.latest_migration_version===EXPECTED_DB_MIGRATION_VERSION,
      detail:`Build verwacht ${EXPECTED_DB_MIGRATION_VERSION}; productie meldt ${snapshot.latest_migration_version||'onbekend'}.`,
    },
    {
      name:'Geen gefaalde offline synchronisaties',
      required:true,
      passed:Number(snapshot.offline_failed)===0,
      detail:`${Number(snapshot.offline_failed)} failed serveroperatie(s).`,
    },
    {
      name:'Geen vastgelopen offline synchronisaties',
      required:true,
      passed:Number(snapshot.offline_stale)===0,
      detail:`${Number(snapshot.offline_stale)} pending operatie(s) ouder dan 5 minuten.`,
    },
    {
      name:'Geen lopende werksessies',
      required:false,
      passed:Number(snapshot.active_sessions)===0,
      detail:`${Number(snapshot.active_sessions)} actieve werksessie(s); deploy kan gebruikers tijdens een actieve shift raken.`,
    },
    {
      name:'Geen actieve pauzes',
      required:false,
      passed:Number(snapshot.active_breaks)===0,
      detail:`${Number(snapshot.active_breaks)} actieve pauze(s).`,
    },
    {
      name:'Geen open help oproepen',
      required:false,
      passed:Number(snapshot.open_incidents)===0,
      detail:`${Number(snapshot.open_incidents)} open help oproep(en).`,
    },
    {
      name:'Geen wachtende start/stopgoedkeuringen',
      required:false,
      passed:pendingApprovals===0,
      detail:`${pendingApprovals} wachtende goedkeuring(en).`,
    },
    {
      name:'Geen nieuwe offline queue',
      required:false,
      passed:Number(snapshot.offline_pending)===0,
      detail:`${Number(snapshot.offline_pending)} nog niet gesynchroniseerde operatie(s).`,
    },
  ]
  const readiness=releaseReadiness(checks)

  return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN BEHEER</p>
        <h1 className="text-3xl font-black">Release readiness</h1>
        <p className="text-sm text-muted-foreground">Runtime- en databasecontrole vóór een productie-release. GitHub CI blijft daarnaast een afzonderlijke verplichte release-gate.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/admin/health" className="rounded-xl border px-4 py-3 font-semibold">Systeemgezondheid</Link>
        <Link href="/admin" className="rounded-xl border px-4 py-3 font-semibold">Beheeroverzicht</Link>
      </div>
    </div>

    <section className={`rounded-2xl border p-5 ${readiness.ready?'border-emerald-500/50 bg-emerald-500/5':'border-red-500/50 bg-red-500/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">{readiness.ready?'RUNTIME RELEASE READY':'RELEASE GEBLOKKEERD'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.ready
              ? readiness.warnings.length
                ? `Geen harde blockers. ${readiness.warnings.length} operationele waarschuwing(en) verdienen controle vóór deploy.`
                : 'Geen harde blockers of operationele waarschuwingen.'
              : `${readiness.failedRequiredChecks.length} harde release blocker(s) gevonden.`}
          </p>
        </div>
        <span className="rounded-full border px-3 py-2 text-xs font-black">
          {new Date(snapshot.checked_at).toLocaleString('nl-BE')}
        </span>
      </div>
    </section>

    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Verplichte checks</h2>
        <p className="text-sm text-muted-foreground">Deze checks moeten groen zijn voordat runtime/database als release-ready wordt beschouwd.</p>
      </div>
      <div className="grid gap-3">
        {checks.filter(check=>check.required).map(check=><CheckRow key={check.name} check={check}/>)}
      </div>
    </section>

    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Operationele waarschuwingen</h2>
        <p className="text-sm text-muted-foreground">Deze blokkeren de release niet automatisch, maar kunnen een slecht deploymoment aanduiden.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {checks.filter(check=>!check.required).map(check=><CheckRow key={check.name} check={check}/>)}
      </div>
    </section>

    <section className="rounded-2xl border p-4">
      <h2 className="font-bold">Externe release-gates</h2>
      <p className="mt-1 text-sm text-muted-foreground">Deze pagina controleert geen GitHub-status. De repository-CI moet afzonderlijk groen zijn voor dependency audit, lint, TypeScript, tests, Next.js build, Cloudflare Worker build en Wrangler dry-run.</p>
    </section>
  </main>
}
