import {supabase} from "./supabase"
import {MIGRATION_WRITES_ENABLED} from "./operational-writes"
import {validWeeztixBarcode,type ScanResult} from "../shared/weeztix-scan"

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}-[0-9a-f]{12}$/i
export const CANDIDATE_TICKET_SCANNING_ENABLED=
 MIGRATION_WRITES_ENABLED&&import.meta.env.VITE_MIGRATION_SCANNING_ENABLED==="true"
export async function scanOwnWeeztixTicket(input:{
 eventId:string;workplaceId:string;barcode:string
}):Promise<ScanResult>{
 // The ticket is consumed by the provider on confirmation, so never queue
 // it for offline replay or retry after an ambiguous network response.
 if(!CANDIDATE_TICKET_SCANNING_ENABLED)throw Error("ticket_scanner_not_released")
 if(!navigator.onLine)throw Error("ticket_scanning_requires_online")
 if(!uuid.test(input.eventId)||!uuid.test(input.workplaceId)||
   !validWeeztixBarcode(input.barcode))throw Error("invalid_ticket")
 const {data:{session},error}=await supabase().auth.getSession()
 if(error||!session?.access_token)throw Error("authentication_required")
 const controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),12000)
 try{
  const response=await fetch("/api/v1/tickets/weeztix/scan",{
   method:"POST",mode:"same-origin",credentials:"omit",
   headers:{Authorization:"Bearer "+session.access_token,
    Accept:"application/json","Content-Type":"application/json"},
   body:JSON.stringify(input),cache:"no-store",redirect:"error",
   referrerPolicy:"no-referrer",signal:controller.signal
  })
  const length=response.headers.get("content-length")
  if(length&&(!/^\d+$/.test(length)||Number(length)>1200))
   throw Error("invalid_provider_reply")
  const payload:unknown=await response.json()
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   throw Error("invalid_provider_reply")
  const row=payload as Record<string,unknown>
  const allowedCodes=new Set<ScanResult["code"]>([
   "admitted","invalid_request","forbidden","unauthorized","not_configured",
   "provider_rejected","ticket_not_found","provider_denied","provider_auth_expired",
   "provider_auth_refreshing","provider_busy","provider_unavailable",
   "scanner_disabled","authorization_unavailable"
  ])
  if(!allowedCodes.has(row.code as ScanResult["code"])||typeof row.ok!=="boolean")
   throw Error("invalid_provider_reply")
  // Absolutely no self-issued acceptance: HTTP 200 AND exact provider
  // admission code AND ok=true must all agree. Otherwise fail closed.
  return {ok:response.status===200&&row.ok===true&&row.code==="admitted",
   code:row.code==="admitted"&&response.status!==200?"unknown":row.code as ScanResult["code"]}
 }finally{clearTimeout(timer)}
}
