'use client'

import {useSyncExternalStore} from 'react'
import {LANGUAGE_APPLIED_EVENT,initialUiLocale,parseUiLocale,type SupportedUiLocale} from '@/lib/locale-preferences'

type Row={id:string;bucket_id:string;storage_path:string;uploaded_by:string|null;uploader_email:string|null;uploader_name:string|null;mime_type:string|null;file_size_bytes:number|null;risk_class:string;status:string;engine:string|null;engine_result:unknown;attempts:number;scanned_at:string|null;created_at:string}
const labels={
 nl:{title:'Uploadbeveiliging',intro:'Overzicht van uploads, scanstatus en mogelijke veiligheidsproblemen.',scans:'Scans',issues:'Problemen',status:'Status',who:'Door wie',file:'Bestand',where:'Locatie',when:'Tijdstip',issue:'Probleem',empty:'Er zijn nog geen uploads geregistreerd.',unavailable:'Uploadbeveiliging kon niet worden opgehaald. De scanstatus is onbekend.',unknown:'Onbekend'},
 fr:{title:'Sécurité des téléchargements',intro:'Téléchargements, résultats des analyses et incidents de sécurité.',scans:'Analyses',issues:'Problèmes',status:'Statut',who:'Auteur',file:'Fichier',where:'Emplacement',when:'Date et heure',issue:'Problème',empty:"Aucun téléchargement enregistré.",unavailable:"Les données de sécurité sont indisponibles. Les analyses ne sont pas vérifiées.",unknown:'Inconnu'},
 en:{title:'Upload security',intro:'Uploads, scan results and potential security issues.',scans:'Scans',issues:'Issues',status:'Status',who:'Uploaded by',file:'File',where:'Location',when:'Time',issue:'Issue',empty:'No uploads recorded yet.',unavailable:'Upload security data could not be loaded. Scan status is unknown.',unknown:'Unknown'},
 de:{title:'Upload-Sicherheit',intro:'Uploads, Scanstatus und mögliche Sicherheitsprobleme.',scans:'Scans',issues:'Probleme',status:'Status',who:'Hochgeladen von',file:'Datei',where:'Speicherort',when:'Zeitpunkt',issue:'Problem',empty:'Noch keine Uploads registriert.',unavailable:'Upload-Sicherheitsdaten sind nicht verfügbar. Der Scanstatus ist unbekannt.',unknown:'Unbekannt'},
} as const
const unsafe=new Set(['infected','suspicious','scan_failed'])
export function UploadSecurityAudit({rows,unavailable=false}:{rows:Row[];unavailable?:boolean}){
 const locale=useSyncExternalStore(
  notify=>{window.addEventListener(LANGUAGE_APPLIED_EVENT,notify);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,notify)},
  ()=>parseUiLocale(document.documentElement.lang)||initialUiLocale(),
  ()=>'nl' as SupportedUiLocale,
 )
 const t=labels[locale]
 const bad=rows.filter(r=>unsafe.has(r.status))
 const dateLocale=({nl:'nl-BE',fr:'fr-BE',en:'en-GB',de:'de-DE'} as const)[locale]
 const formatDate=(date:string)=>new Intl.DateTimeFormat(dateLocale,{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Brussels'}).format(new Date(date))
 const errorText=(row:Row)=>unsafe.has(row.status)?JSON.stringify(row.engine_result,null,2)||'—':'—'
 return <section className="min-w-0 space-y-4 rounded-2xl border p-4 md:p-5">
  <header><h2 className="text-lg font-black">{t.title}</h2><p className="text-sm text-muted-foreground">{t.intro}</p></header>
  {unavailable?<p role="alert" className="rounded-lg border border-amber-500/50 p-3 text-sm">{t.unavailable}</p>:<>
   <div className="grid grid-cols-2 gap-2">
    <div className="rounded-xl border p-3"><b className="text-2xl tabular-nums">{rows.length}</b><p className="text-xs">{t.scans}</p></div>
    <div className="rounded-xl border p-3"><b className="text-2xl tabular-nums">{bad.length}</b><p className="text-xs">{t.issues}</p></div>
   </div>
   {!rows.length?<p className="rounded-xl border p-4 text-sm text-muted-foreground">{t.empty}</p>:<>
    <div className="grid gap-3 md:hidden">
     {rows.map(row=><article key={row.id} className="min-w-0 space-y-2 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><b>{row.status}</b><span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span></div>
      <p className="break-all font-semibold">{row.storage_path.split('/').pop()||t.unknown}</p>
      <p>{t.who}: {row.uploader_name||row.uploader_email||row.uploaded_by||'—'}</p>
      <p className="break-all text-xs text-muted-foreground">{row.bucket_id} / {row.storage_path}</p>
      <p className="text-xs text-muted-foreground">{row.mime_type||'—'} · {row.file_size_bytes===null?'—':Math.ceil(row.file_size_bytes/1024)+' KB'}</p>
      {unsafe.has(row.status)&&<pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs">{errorText(row)}</pre>}
     </article>)}
    </div>
    <div className="hidden max-w-full overflow-x-auto md:block">
     <table className="w-full text-left text-sm"><thead><tr className="border-b">
      {[t.status,t.who,t.file,t.where,t.when,t.issue].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}
     </tr></thead><tbody>
      {rows.map(row=><tr key={row.id} className="border-b align-top">
       <td className="p-2 font-bold">{row.status}</td>
       <td className="max-w-40 break-words p-2">{row.uploader_name||row.uploader_email||row.uploaded_by||'—'}</td>
       <td className="p-2"><div className="max-w-xs break-all">{row.storage_path.split('/').pop()}</div><div className="text-xs text-muted-foreground">{row.mime_type||'—'} · {row.file_size_bytes===null?'—':Math.ceil(row.file_size_bytes/1024)+' KB'}</div></td>
       <td className="p-2"><div>{row.bucket_id}</div><div className="max-w-xs break-all text-xs text-muted-foreground">{row.storage_path}</div></td>
       <td className="whitespace-nowrap p-2">{formatDate(row.created_at)}</td>
       <td className="p-2"><pre className="max-w-md whitespace-pre-wrap break-words text-xs">{errorText(row)}</pre></td>
      </tr>)}
     </tbody></table>
    </div>
   </>}
  </>}
 </section>
}
