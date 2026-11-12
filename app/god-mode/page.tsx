import { cookies } from 'next/headers'
import { godModeLogout,returnToNormalAppFromGodMode } from '@/lib/actions/god-mode'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { GodStudio } from '@/components/god-mode/god-studio'
import { UploadSecurityAudit } from '@/components/god-mode/upload-security-audit'
import {requiredGodEnvironment} from '@/lib/god-mode-environments'
import {requestUiLocale} from '@/lib/server-locale'

const pageText={
 nl:{active:'Actieve omgeving',main:'Wijzigingen eerst op Main testen',production:'Productie vereist afzonderlijke vrijgave',normal:'Normale app openen',logout:'God Mode afmelden',security:'Uploadbeveiliging · audit en scans'},
 fr:{active:'Environnement actif',main:"Tester les changements sur Main d’abord",production:'La production requiert une validation séparée',normal:"Ouvrir l’application",logout:'Quitter God Mode',security:'Sécurité des fichiers · analyses et audit'},
 en:{active:'Active environment',main:'Test changes on Main first',production:'Production requires separate approval',normal:'Open normal app',logout:'Sign out of God Mode',security:'Upload security · audit and scans'},
 de:{active:'Aktive Umgebung',main:'Änderungen zuerst auf Main testen',production:'Produktion erfordert separate Freigabe',normal:'Normale App öffnen',logout:'God Mode abmelden',security:'Upload-Sicherheit · Prüfungen und Audit'},
} as const

export const dynamic='force-dynamic'

export default async function GodModePage(){
  const environment=requiredGodEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const t=pageText[await requestUiLocale()]
  const token=(await cookies()).get('uptilldawn-god-session')?.value
  if(!token)redirect('/god-mode/login')
  const s=await createClient()
  const {data:valid}=await s.rpc('upt_god_session_valid',{p_token:token})
  if(valid!==true)redirect('/god-mode/login')

  const admin=await createClient()
  const {data:securityRows,error:securityError}=await admin.rpc('upt_god_upload_security_audit',{p_token:token,p_limit:200})

  return <main className="min-h-screen bg-background p-4 pb-16 md:p-8">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-500">God Mode</p>
        <h1 className="mt-1 text-3xl font-black">App Studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Programmeer de app, bewerk gegevens en beheer logica, workflows en versies.</p>
        <p className="mt-3 text-xs font-semibold text-amber-400">{t.active}: {environment.label} · {environment.id==='main'?t.main:t.production}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={returnToNormalAppFromGodMode}><button className="rounded-xl border px-4 py-2 text-sm font-bold">{t.normal}</button></form>
          <form action={godModeLogout}><button className="rounded-xl border px-4 py-2 text-sm font-bold">{t.logout}</button></form>
        </div>
      </header>
      <GodStudio/>
      <details className="rounded-2xl border bg-card/40 p-3">
        <summary className="cursor-pointer px-2 py-3 text-sm font-bold">{t.security} ({securityError?'?':(securityRows||[]).length})</summary>
        <div className="mt-3"><UploadSecurityAudit rows={securityRows||[]} unavailable={Boolean(securityError)}/></div>
      </details>
    </div>
  </main>
}
