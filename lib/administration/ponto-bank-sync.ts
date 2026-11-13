import "server-only"
import type {BankStatementImportRow} from "./bank-statement-import"
import {pontoAccessToken,pontoReadOnlyJson} from "./provider-connection-check"
import {normalizePontoBankPage} from "./ponto-bank-normalizer"
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

/** On-demand, read-only Ponto AIS sync. No payment initiation or automatic
 * invoice settlement. The caller commits the complete validated batch through
 * the existing idempotent, authorization-checked bank-import RPC.
 */
export async function fetchPontoBankStatementRows(env:NodeJS.ProcessEnv):Promise<{rows:BankStatementImportRow[];accountCount:number}>{
 const grant=await pontoAccessToken(env)
 if(!grant.token)throw Error(grant.state==="not_configured"?"not_configured":"ponto_authorization_unavailable")
 const accounts=await pontoReadOnlyJson("/accounts?page%5Blimit%5D=100",grant.token,262144)
 if(!accounts||typeof accounts!=="object"||Array.isArray(accounts)||!("data" in accounts)||!Array.isArray(accounts.data)||
    accounts.data.length>10)throw Error("ponto_account_limit_or_invalid")
 const accountPage=accounts as {data:unknown[];links?:unknown}
 if(accountPage.links&&typeof accountPage.links==="object"&&"next" in accountPage.links&&accountPage.links.next)
  throw Error("ponto_account_limit_or_invalid")
 if(!accountPage.data.length)throw Error("needs_account_access")
 const seenAccounts=new Set<string>(),allRows:BankStatementImportRow[]=[]
 let activeAccounts=0
 for(const entry of accountPage.data){
  if(!entry||typeof entry!=="object"||Array.isArray(entry))throw Error("ponto_account_limit_or_invalid")
  const value=entry as Record<string,unknown>
  if(value.type!=="account"||typeof value.id!=="string"||!uuid.test(value.id)||seenAccounts.has(value.id))
   throw Error("ponto_account_limit_or_invalid")
  seenAccounts.add(value.id)
  const attrs=value.attributes
  if(!attrs||typeof attrs!=="object"||Array.isArray(attrs)||!("currency" in attrs)||typeof attrs.currency!=="string")
   throw Error("ponto_account_limit_or_invalid")
  if(attrs.currency!=="EUR")continue
  activeAccounts++
  let cursor:string|null=null
  const seenPages=new Set<string>(),seenTransactions=new Set<string>()
  for(let pageIndex=0;pageIndex<5;pageIndex++){
   const path="/accounts/"+value.id+"/transactions?page%5Blimit%5D=100"+(cursor?"&page%5Bafter%5D="+encodeURIComponent(cursor):"")
   const response=await pontoReadOnlyJson(path,grant.token,262144)
   const page=normalizePontoBankPage(response,value.id)
   for(const row of page.rows){
    if(seenTransactions.has(row.transactionId))throw Error("ponto_duplicate_transaction")
    seenTransactions.add(row.transactionId);allRows.push(row)
   }
   if(allRows.length>500)throw Error("ponto_transaction_limit")
   if(!page.next)return {rows:allRows,accountCount:activeAccounts}
   if(seenPages.has(page.next))throw Error("ponto_invalid_paging")
   seenPages.add(page.next);cursor=page.next
  }
  throw Error("ponto_transaction_limit")
 }
 if(activeAccounts===0)throw Error("ponto_no_eur_accounts")
 return {rows:allRows,accountCount:activeAccounts}
}
