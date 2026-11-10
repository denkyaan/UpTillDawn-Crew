'use client'

import {useActionState,useSyncExternalStore} from 'react'
import {provisionOwnerQaBots,type QaBotProvisionState} from '@/lib/actions/maker-qa-bots'
import {LANGUAGE_APPLIED_EVENT,initialUiLocale,parseUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

const copy={
 nl:{
  heading:'Zeven QA-rolbots',
  detail:'Alleen op de main-testomgeving: Hoofdadmin, Linkerhand, Rechterhand, Verantwoordelijke, Personeel, Promotie en Administratie. Je Maker-account wordt niet aangepast.',
  pending:'Testbots instellen…',
  setup:'Zeven rolbots instellen en beveiligen',
  download:'Download de 7 unieke inloggegevens (CSV)',
  private:'Bewaar dit bestand privé. De wachtwoorden worden niet in deze app opgeslagen of opnieuw weergegeven.',
 },
 fr:{
  heading:'Sept bots de test par rôle',
  detail:'Uniquement pour le test principal : administrateur principal, adjoint gauche, adjoint droit, responsable, personnel, promotion et administration. Votre compte Créateur reste inchangé.',
  pending:'Configuration des bots…',
  setup:'Configurer et sécuriser les sept bots',
  download:'Télécharger les 7 identifiants uniques (CSV)',
  private:'Conservez ce fichier en lieu sûr. Les mots de passe ne sont pas conservés ni affichés à nouveau dans l’application.',
 },
 en:{
  heading:'Seven role-based QA bots',
  detail:'Main test environment only: Head Admin, Left Hand, Right Hand, Responsible, Staff, Promotion and Administration. Your Maker account stays unchanged.',
  pending:'Setting up test bots…',
  setup:'Set up and secure seven role bots',
  download:'Download all 7 unique logins (CSV)',
  private:'Keep this file private. Passwords are not saved or shown again inside the app.',
 },
 de:{
  heading:'Sieben QA-Rollenbots',
  detail:'Nur in der Main-Testumgebung: Hauptadmin, linke Hand, rechte Hand, Verantwortliche, Personal, Promotion und Verwaltung. Dein Maker-Konto bleibt unverändert.',
  pending:'Testbots werden eingerichtet…',
  setup:'Sieben Rollenbots einrichten und sichern',
  download:'Alle 7 Zugangsdaten herunterladen (CSV)',
  private:'Bewahre diese Datei sicher auf. Die Passwörter werden nicht in der App gespeichert oder erneut angezeigt.',
 },
} as const
const initial:QaBotProvisionState={status:'idle',message:'',accounts:[]}
function csvCell(value:string){return '"'+value.replaceAll('"','""')+'"'}
function downloadCredentials(accounts:QaBotProvisionState['accounts']){
 const rows=[['Rol','Login','Wachtwoord'],...accounts.map(account=>[account.role,account.email,account.password])]
 const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'})
 const url=URL.createObjectURL(file)
 const link=document.createElement('a')
 link.href=url
 link.download='UpTillDawn-7-testbots-login.csv'
 document.body.append(link)
 link.click()
 link.remove()
 // iPhone Safari can begin the download after the click handler returns.
 window.setTimeout(()=>URL.revokeObjectURL(url),5000)
}
export function MakerQaBotSetup(){
 const locale=useSyncExternalStore(
  (notify)=>{window.addEventListener(LANGUAGE_APPLIED_EVENT,notify);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,notify)},
  ()=>parseUiLocale(document.documentElement.lang)||initialUiLocale(),
  ()=>'nl' as SupportedUiLocale,
 )
 const t=copy[locale]
 const [state,action,pending]=useActionState(provisionOwnerQaBots,initial)
 return <section className="mt-7 rounded-2xl border border-white/10 bg-black/40 p-4">
  <h2 className="font-bold text-white">{t.heading}</h2>
  <p className="mt-1 text-sm text-zinc-400">{t.detail}</p>
  <form action={action} className="mt-3">
   <button type="submit" disabled={pending} className="w-full rounded-xl border border-violet-500/50 bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
    {pending?t.pending:t.setup}
   </button>
  </form>
  {state.message&&<p role={state.status==='error'?'alert':'status'} className={'mt-3 text-sm '+(state.status==='error'?'text-red-300':'text-green-300')}>{state.message}</p>}
  {state.status==='ok'&&state.accounts.length===7&&<>
   <button type="button" onClick={()=>downloadCredentials(state.accounts)} className="mt-3 w-full rounded-xl border border-green-600/60 px-4 py-3 text-sm font-bold text-green-300">
    {t.download}
   </button>
   <p className="mt-2 text-xs text-zinc-400">{t.private}</p>
  </>}
 </section>
}
