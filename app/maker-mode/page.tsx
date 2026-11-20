import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { enterGodModeFromMakerSession } from '@/lib/actions/god-mode'
import { enterNormalAppFromMakerSession } from '@/lib/actions/auth'

export const dynamic='force-dynamic'

export default async function MakerModePage({
  searchParams,
}:{
  searchParams:Promise<{portal?:string;error?:string}>
}){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login/admin')

  const {data:isOwner}=await s.rpc('upt_current_is_owner')
  if(isOwner!==true)redirect('/unauthorized')

  const params=await searchParams
  const portal=params.portal==='staff'||params.portal==='responsible'||params.portal==='admin'
    ? params.portal
    : 'admin'
  return <main className="grid min-h-screen place-items-center bg-black p-5 text-white">
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">Maker</p>
      <h1 className="mt-2 text-3xl font-black">Kies je modus</h1>
      <p className="mt-2 text-sm text-zinc-400">Je bent aangemeld als maker. Kies of je de gewone app wilt gebruiken of God Mode wilt openen.</p>
      {params.error?<p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">God Mode kon niet worden gestart. Probeer opnieuw.</p>:null}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <form action={enterNormalAppFromMakerSession}>
          <input type="hidden" name="portal" value={portal} />
          <button className="h-full w-full rounded-2xl border border-white/15 bg-white/5 p-5 text-left transition hover:bg-white/10">
            <div className="text-lg font-black">Normale app</div>
            <div className="mt-1 text-sm text-zinc-400">Ga verder in het gekozen portaal.</div>
          </button>
        </form>
        <form action={enterGodModeFromMakerSession}>
          <button className="h-full w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-left transition hover:bg-amber-500/20">
            <div className="text-lg font-black text-amber-300">God Mode</div>
            <div className="mt-1 text-sm text-zinc-300">Open App Studio met volledige makerrechten.</div>
          </button>
        </form>
      </div>
    </section>
  </main>
}
