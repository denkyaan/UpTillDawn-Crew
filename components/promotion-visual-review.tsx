"use client"

import {useEffect,useState} from "react"
import {comparePromotionImages} from "@/lib/promotion-image-similarity.mjs"

type Locale="nl"|"fr"|"en"|"de"
const copy={
 nl:{button:"Beelden vergelijken",busy:"Vergelijking bezig…",result:"Visuele overeenkomst",warning:"Alleen een controlesignaal; geen bewijs van publicatie en nooit een automatische strike.",error:"Vergelijking niet mogelijk. Vernieuw de pagina als de tijdelijke links verlopen zijn."},
 fr:{button:"Comparer les images",busy:"Comparaison en cours…",result:"Similarité visuelle",warning:"Simple indice de contrôle, sans preuve de publication ni sanction automatique.",error:"Comparaison impossible. Actualisez la page si les liens ont expiré."},
 en:{button:"Compare images",busy:"Comparing…",result:"Visual similarity",warning:"Review signal only; not proof of publication and never an automatic strike.",error:"Comparison unavailable. Refresh if temporary links have expired."},
 de:{button:"Bilder vergleichen",busy:"Vergleich läuft…",result:"Visuelle Ähnlichkeit",warning:"Nur ein Prüfsignal; kein Veröffentlichungsnachweis und niemals eine automatische Verwarnung.",error:"Vergleich nicht möglich. Bei abgelaufenen Links die Seite neu laden."}
} as const

async function pixels(url:string){
 const response=await fetch(url,{credentials:"omit",cache:"no-store"})
 if(!response.ok)throw new Error("Image unavailable")
 const blob=await response.blob()
 if(blob.size>10*1024*1024||!blob.type.startsWith("image/"))throw new Error("Invalid image")
 const bitmap=await createImageBitmap(blob)
 try{
  const factor=Math.min(1,512/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*factor))
  const height=Math.max(1,Math.round(bitmap.height*factor))
  const canvas=document.createElement("canvas")
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext("2d",{willReadFrequently:true})
  if(!ctx)throw new Error("Canvas unavailable")
  ctx.drawImage(bitmap,0,0,width,height)
  return {width,height,data:ctx.getImageData(0,0,width,height).data}
 }finally{bitmap.close()}
}
export function PromotionVisualReview({evidenceUrl,referenceUrls,locale}:{evidenceUrl:string;referenceUrls:string[];locale:Locale}){
 const [score,setScore]=useState<number|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState(false)
 const t=copy[locale]
 async function compare(){
  setBusy(true);setError(false);setScore(null)
  try{
   const evidence=await pixels(evidenceUrl)
   let best=0
   for(const url of referenceUrls.slice(0,10)){
    const reference=await pixels(url)
    best=Math.max(best,comparePromotionImages(reference,evidence))
   }
   setScore(best)
  }catch{setError(true)}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  // Recalculate when an administrator opens the review page or signed URLs rotate.
  // This remains local and does not change verification status or issue strikes.
  let active=true
  async function run(){
   setBusy(true);setError(false);setScore(null)
   try{
    const evidence=await pixels(evidenceUrl)
    let best=0
    for(const url of referenceUrls.slice(0,10)){
     const reference=await pixels(url)
     best=Math.max(best,comparePromotionImages(reference,evidence))
    }
    if(active)setScore(best)
   }catch{if(active)setError(true)}
   finally{if(active)setBusy(false)}
  }
  void run()
  return ()=>{active=false}
 },[evidenceUrl,referenceUrls.join("|")])
 return <div className="mt-2 space-y-1">
  <button type="button" onClick={compare} disabled={busy} className="rounded border border-violet-500 px-2 py-1 text-xs disabled:opacity-50">{busy?t.busy:t.button}</button>
  {score!==null&&<p>{t.result}: {Math.round(score*100)}%</p>}
  {error&&<p role="alert" className="text-red-500">{t.error}</p>}
  <p className="text-xs text-amber-600">{t.warning}</p>
 </div>
}
