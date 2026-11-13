import {NextResponse} from "next/server"
import type {SupabaseClient} from "@supabase/supabase-js"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {getManagedIntegrationConfig} from "@/lib/administration/integration-store"
import {fetchPontoBankStatementRows} from "@/lib/administration/ponto-bank-sync"

export const dynamic="force-dynamic"
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers})

/** Explicit operator action. Observes transactions from the provider and
 * imports to the review ledger only; never posts invoice payments or transfers.
 */
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return reply({error:"forbidden"},403)
 const access=await integrationManagementAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 let config
 try{config=await getManagedIntegrationConfig(access.db,"banking")}
 catch{return reply({error:"integration_storage_unavailable"},503)}
 if(!config?.PONTO_CLIENT_ID||!config.PONTO_CLIENT_SECRET)
  return reply({error:"not_configured"},409)
 let importBatch
 try{
  importBatch=await fetchPontoBankStatementRows({
   PONTO_CLIENT_ID:config.PONTO_CLIENT_ID,PONTO_CLIENT_SECRET:config.PONTO_CLIENT_SECRET
  } as NodeJS.ProcessEnv)
 }catch(error){
  const key=error instanceof Error?error.message:""
  if(key==="needs_account_access"||key==="ponto_no_eur_accounts")
   return reply({error:key},409)
  if(key==="ponto_transaction_limit"||key==="ponto_account_limit_or_invalid")
   return reply({error:key},422)
  return reply({error:"ponto_unavailable_or_invalid_data"},503)
 }
 if(importBatch.rows.length===0)return reply({result:{inserted:0,skipped:0},accountCount:importBatch.accountCount})
 // SQL repeats the Administration permissions, reconciles duplicate IDs with
 // identical content and rejects a conflicting batch atomically.
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc("upt_admin_import_bank_statement_transactions",{
  p_rows:importBatch.rows
 })
 if(error)return reply({error:error.code==="23505"?"conflicting_transaction":
  error.code==="42501"?"access_denied":"import_rejected"},error.code==="23505"?409:error.code==="42501"?403:422)
 if(!data||typeof data!=="object"||
    !("inserted" in data)||!("skipped" in data)||
    !Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)||
    data.inserted+data.skipped!==importBatch.rows.length)
  return reply({error:"unexpected_import_result"},503)
 return reply({result:{inserted:data.inserted,skipped:data.skipped},accountCount:importBatch.accountCount})
}
