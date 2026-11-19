import {useCallback,useEffect,useRef,useState,type FormEvent} from "react"
import {useLocale} from "../lib/use-locale"
import {scanOwnWeeztixTicket,CANDIDATE_TICKET_SCANNING_ENABLED} from "../lib/weeztix-scan"
import {scanCopy,scanNotice,validWeeztixBarcode,type ScanResult} from "../shared/weeztix-scan"

type QrReader=(pixels:Uint8ClampedArray,width:number,height:number,
 options?:{inversionAttempts:string})=>{data:string}|null
type QrWindow=Window&{jsQR?:QrReader}
let decoderInFlight:Promise<QrReader>|null=null
function loadDecoder():Promise<QrReader>{
 const active=(window as QrWindow).jsQR
 if(active)return Promise.resolve(active)
 if(decoderInFlight)return decoderInFlight
 decoderInFlight=new Promise<QrReader>((resolve,reject)=>{
  const script=document.createElement("script")
  script.src="/vendor/jsqr-1.4.0.js";script.async=true
  script.onload=()=>{
   const decoder=(window as QrWindow).jsQR
   if(decoder)resolve(decoder)
   else reject(Error("local_decoder_unavailable"))
  }
  script.onerror=()=>reject(Error("local_decoder_failed"))
  document.head.append(script)
 }).catch(error=>{decoderInFlight=null;throw error})
 return decoderInFlight
}
// This component is embedded ONLY in its existing entrance workplace card,
// not a duplicate scanner page or navigation tab.
export default function WeeztixScanner({eventId,workplaceId}:{
 eventId:string;workplaceId:string
}){
 const {locale}=useLocale(),t=scanCopy[locale]
 const [input,setInput]=useState("")
 const [result,setResult]=useState<ScanResult|null>(null)
 const [camera,setCamera]=useState(false)
 const [loadingCamera,setLoadingCamera]=useState(false)
 const [cameraError,setCameraError]=useState(false)
 const [busy,setBusy]=useState(false)
 const video=useRef<HTMLVideoElement>(null)
 const canvas=useRef<HTMLCanvasElement>(null)
 const stream=useRef<MediaStream|null>(null)
 const animation=useRef<number|null>(null)
 const decoder=useRef<QrReader|null>(null)
 const mounted=useRef(false)
 const sending=useRef(false)
 const frameMs=useRef(0)
 const previous=useRef<{barcode:string;time:number}>({barcode:"",time:0})
 const stopCamera=useCallback(()=>{
  if(animation.current!==null){cancelAnimationFrame(animation.current);animation.current=null}
  stream.current?.getTracks().forEach(track=>track.stop())
  stream.current=null
  if(video.current)video.current.srcObject=null
  if(mounted.current)setCamera(false)
 },[])
 useEffect(()=>{
  mounted.current=true
  return()=>{mounted.current=false;stopCamera()}
 },[stopCamera])
 const send=useCallback(async(value:string)=>{
  if(sending.current||!CANDIDATE_TICKET_SCANNING_ENABLED)return
  const barcode=value.trim()
  if(!validWeeztixBarcode(barcode)){
   setResult({ok:false,code:"invalid_request"});return
  }
  const now=Date.now()
  if(previous.current.barcode===barcode&&now-previous.current.time<10000){
   // No implicit second admission attempt; operators must confirm
   // vendor status instead of accidentally double-consuming a ticket.
   setResult({ok:false,code:"unknown"});return
  }
  previous.current={barcode,time:now}
  sending.current=true;setBusy(true);setResult(null)
  try{
   const answer=await scanOwnWeeztixTicket({eventId,workplaceId,barcode})
   if(mounted.current){setResult(answer);setInput("");stopCamera()}
  }catch{if(mounted.current){setResult({ok:false,code:"provider_unavailable"});stopCamera()}}
  finally{sending.current=false;if(mounted.current)setBusy(false)}
 },[eventId,workplaceId,stopCamera])
 const scanFrame=useCallback(()=>{
  const loop=()=>{
   if(!mounted.current||!stream.current)return
   animation.current=requestAnimationFrame(loop)
   if(sending.current||performance.now()-frameMs.current<200)return
   frameMs.current=performance.now()
   const v=video.current,c=canvas.current,qr=decoder.current
   if(!v||!c||!qr||v.readyState<2||v.videoWidth<1)return
   const width=Math.min(720,v.videoWidth)
   const height=Math.max(1,Math.round(width*v.videoHeight/v.videoWidth))
   c.width=width;c.height=height
   const context=c.getContext("2d",{willReadFrequently:true})
   if(!context)return
   context.drawImage(v,0,0,width,height)
   const pixels=context.getImageData(0,0,width,height)
   const found=qr(pixels.data,width,height,{inversionAttempts:"attemptBoth"})
   if(found?.data)void send(found.data)
  }
  loop()
 },[send])
 async function startCamera(){
  if(loadingCamera||camera||!CANDIDATE_TICKET_SCANNING_ENABLED)return
  setLoadingCamera(true);setCameraError(false);setResult(null)
  try{
   decoder.current=await loadDecoder()
   if(!mounted.current)return
   const media=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280}}
   })
   if(!mounted.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media
   if(!video.current)throw Error("video_missing")
   video.current.srcObject=media
   await video.current.play()
   if(!mounted.current)return
   setCamera(true)
   scanFrame()
  }catch{stopCamera();if(mounted.current)setCameraError(true)}
  finally{if(mounted.current)setLoadingCamera(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();void send(input)}
 return <section className="card" aria-label={t.title}>
  <div className="row"><h3>{t.title}</h3>
   {camera&&<button type="button" onClick={stopCamera}>{t.stop}</button>}</div>
  <p className="muted">{t.note}</p>
  {!CANDIDATE_TICKET_SCANNING_ENABLED?<p className="notice" role="status">{t.inactive}</p>:
   <button type="button" disabled={loadingCamera||busy||camera}
    onClick={()=>void startCamera()}>{loadingCamera?t.loadingDecoder:t.start}</button>}
  {camera&&<p className="muted">{t.ready}</p>}
  <video ref={video} autoPlay playsInline muted className={camera?"scanner-preview":"sr-only"} />
  <canvas ref={canvas} aria-hidden="true" className="sr-only"/>
  {cameraError&&<p role="alert" className="error">{t.cameraError}</p>}
  {CANDIDATE_TICKET_SCANNING_ENABLED&&<form onSubmit={submit}>
   <label>{t.manual}<input type="text" inputMode="text" autoComplete="off"
    maxLength={160} value={input} onChange={e=>setInput(e.target.value)}/></label>
   <button className="primary" type="submit" disabled={busy||!input.trim()}>{t.verify}</button>
  </form>}
  {busy&&<p role="status">{t.loading}</p>}
  {result&&!busy&&<p aria-live="assertive" role="status"
   className={result.ok?"scanner-approved":"scanner-denied"}>
   {scanNotice(result,locale)}
   {!result.ok&&<span className="muted"> {t.retry}</span>}
  </p>}
 </section>
}
