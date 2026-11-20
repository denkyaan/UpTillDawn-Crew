'use client'
import {useState} from 'react'
import Link from 'next/link'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
import type {PeppolIssue} from '@/lib/administration/peppol'
import {peppolCopy,peppolFieldLabels,localeIndex} from '@/lib/administration/peppol-copy'

export default function PeppolPreparation({documentId,locale}:{documentId:string;locale:SupportedUiLocale}){
 const t=peppolCopy[locale],index=localeIndex[locale]
 const [report,setReport]=useState<{ready:boolean;issues:PeppolIssue[]}|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(false)
 async function execute(download:boolean){
  setPending(true);setError(false)
  try{
   const response=await fetch('/api/administration/peppol/prepare'+(download?'':'?documentId='+documentId),download?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId})}:{cache:'no-store'})
   if(download&&response.ok){const file=await response.blob(),url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download='peppol-'+documentId+'.xml';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
   const result=await response.json()
   if(!Array.isArray(result.issues))throw Error('Unavailable')
   setReport({ready:result.ready===true,issues:result.issues})
  }catch{setError(true)}finally{setPending(false)}
 }
 function issueLabel(issue:PeppolIssue){const parts=issue.path.split('.'),field=parts.at(-1) as keyof typeof peppolFieldLabels;const context=parts[0]==='lines'?`${t.line} ${parts[1]??''}`:parts[0]==='seller'?t.seller:parts[0]==='buyer'?t.buyer:t.document;return `${context}: ${peppolFieldLabels[field]?.[index]??t.document} — ${t[issue.code]}`}
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={t.title}>
  <h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p>
  <Link href="/portals/administration/modules/settings" className="block text-sm text-violet-400 underline">{t.settings}</Link>
  <button disabled={pending} onClick={()=>void execute(false)} className="rounded-lg border px-4 py-3 disabled:opacity-50">{pending?t.pending:t.check}</button>
  {error&&<p role="alert">{t.error}</p>}
  {report&&(report.ready?<p role="status" className="text-green-500">{t.ready}</p>:<div role="status"><h2 className="font-semibold">{t.missing}</h2><ul className="list-disc space-y-1 pl-5 text-sm">{report.issues.map((issue,i)=><li key={i}>{issueLabel(issue)}</li>)}</ul></div>)}
  {report?.ready&&<button disabled={pending} onClick={()=>void execute(true)} className="block rounded-lg bg-violet-600 px-4 py-3 text-white disabled:opacity-50">{t.download}</button>}
 </section>
}
