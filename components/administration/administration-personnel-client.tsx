"use client"

import {useEffect,useMemo,useState} from "react"
import Image from "next/image"
import {createClient} from "@/lib/supabase/crew-client"
import {signedDirectoryPhotoUrls} from "@/lib/crew/signed-directory-photo-urls"
import {translateQaBotName} from "@/lib/ui-translation-catalog-app"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {AdministrationPrivateChatButton} from "@/components/administration/administration-private-chat-button"

const copy={
 nl:{title:"Personeel",empty:"Geen goedgekeurde medewerkers gevonden.",loading:"Personeel laden…",failed:"De personeelslijst kon niet worden geladen.",retry:"Opnieuw proberen"},
 fr:{title:"Personnel",empty:"Aucun membre approuvé.",loading:"Chargement du personnel…",failed:"Impossible de charger le personnel.",retry:"Réessayer"},
 en:{title:"Staff",empty:"No approved staff found.",loading:"Loading staff…",failed:"Could not load staff directory.",retry:"Try again"},
 de:{title:"Personal",empty:"Keine genehmigten Mitarbeitenden gefunden.",loading:"Personal wird geladen…",failed:"Das Personalverzeichnis konnte nicht geladen werden.",retry:"Erneut versuchen"},
} as const

type Member={
 id:string
 full_name:string|null
 phone_number:string|null
 profile_photo_url:string|null
}
export function AdministrationPersonnelClient({initialLocale,currentUserId}:{
 initialLocale:SupportedUiLocale;currentUserId:string
}){
 const db=useMemo(()=>createClient(),[])
 const [locale,setLocale]=useState<SupportedUiLocale>(initialLocale)
 const [members,setMembers]=useState<Member[]>([])
 const [photos,setPhotos]=useState<Record<string,string>>({})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [refreshKey,setRefreshKey]=useState(0)
 useEffect(()=>{
  const update=()=>setLocale(activeUiLocale())
  update()
  addEventListener(LANGUAGE_APPLIED_EVENT,update)
  return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,update)
 },[])
 useEffect(()=>{
  let live=true
  async function load(){
   const {data,error:directoryError}=await db.rpc("upt_crew_directory")
   if(!live)return
   if(directoryError){
    setError(true);setMembers([]);setPhotos({});setLoading(false)
    return
   }
   const directory:Member[]=(data??[]).map(member=>({
    id:member.id,full_name:member.full_name,
    phone_number:member.phone_number,profile_photo_url:member.profile_photo_url,
   }))
   setMembers(directory);setError(false);setLoading(false)
   // All signed URLs are created on the user's authenticated Supabase
   // browser session, not via the Cloudflare Worker. Private bucket RLS
   // applies; invalid photo paths are omitted without exposing a fallback.
   const signed=await signedDirectoryPhotoUrls(directory,
    (paths,expiresIn)=>db.storage.from("profile-photos").createSignedUrls(paths,expiresIn))
   if(live)setPhotos(signed)
  }
  void load().catch(()=>{if(live){setError(true);setLoading(false)}})
  return()=>{live=false}
 },[db,refreshKey])
 const sorted=useMemo(()=>[...members].sort((a,b)=>
  translateQaBotName(a.full_name??"",locale).localeCompare(
   translateQaBotName(b.full_name??"",locale),locale)),[locale,members])
 const t=copy[locale]
 return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
  <h1 className="text-2xl font-bold">{t.title} · {loading?"—":error?"—":sorted.length}</h1>
  {loading?<p role="status">{t.loading}</p>
   :error?<div role="alert" className="space-y-3"><p>{t.failed}</p>
      <button type="button" className="rounded-lg border px-3 py-2" onClick={()=>{
       setLoading(true);setError(false);setRefreshKey(value=>value+1)
      }}>{t.retry}</button></div>
   :<div className="grid gap-3 sm:grid-cols-2">
    {sorted.map(member=><article key={member.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
     <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-violet-500/10">
      {photos[member.id]
       ?<Image src={photos[member.id]} alt="" fill sizes="48px" unoptimized className="object-cover"/>
       :<span className="grid h-full place-items-center font-semibold">{(member.full_name||"?").slice(0,1)}</span>}
     </div>
     <div className="min-w-0">
      <p className="truncate font-semibold">{translateQaBotName(member.full_name??"",locale)}</p>
      {member.phone_number&&<a className="text-sm text-violet-400 underline" href={`tel:${member.phone_number}`}>{member.phone_number}</a>}
      {member.id!==currentUserId&&<AdministrationPrivateChatButton personId={member.id} locale={locale}/>}
     </div>
    </article>)}
    {!sorted.length&&<p>{t.empty}</p>}
   </div>}
 </main>
}
