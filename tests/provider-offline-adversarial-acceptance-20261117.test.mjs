import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript'
import {validAccountAccess} from '../lib/administration/provider-account-access.ts'
import {validateProviderTransactionCsv} from '../lib/administration/provider-transaction-import.ts'
import {buildSalesReconciliationReport} from '../lib/administration/sales-reconciliation-report.ts'
import {resolveProviderEvent} from '../lib/administration/provider-event-mapping.ts'
import {parseWeeztixOAuthTokenResponse} from '../lib/administration/weeztix-oauth.ts'
import {isEntranceWorkplace,validWeeztixBarcode} from '../lib/weeztix-scanner.ts'
import {previewProviderSettlement} from '../lib/administration/provider-bank-settlement.ts'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const fake='OFFLINE-FAKE-CREDENTIAL-NO-ACCOUNT'
const eventId='123e4567-e89b-42d3-a456-426614174000'
const secondEventId='123e4567-e89b-42d3-a456-426614174001'
const externalEvent='evt:offline-test'
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{'Content-Type':'application/json'}
})
const denied=status=>new Response('',{status})
const record=(id,category,ref,amount,status='paid',event=externalEvent)=>
 [id,event,category,ref,status,amount,'EUR','2026-11-17T12:00:00+01:00'].join(',')+'\n'
const header='transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at\n'

/** Execute ACTUAL server-only probe code inside an isolated VM with a closed,
 * fake HTTP transport. The test never calls an external provider or changes
 * process.env. TypeScript is transpiled, not rewritten or duplicated.
 * Only the already-tested pure Ponto JSON:API account validator is imported.
 */
function isolatedProviderProbe(respond){
 const source=read('lib/administration/provider-connection-check.ts')
 const code=transpileModule(source,{compilerOptions:{
  target:ScriptTarget.ES2022,module:ModuleKind.CommonJS
 }}).outputText
 const mod={exports:{}},calls=[]
 const sandbox={
  module:mod,exports:mod.exports,Buffer,URL,AbortSignal,TextDecoder,Uint8Array,
  fetch:async (url,init)=>{
   calls.push({url:String(url),method:init.method,headers:init.headers,
    redirect:init.redirect,cache:init.cache,body:init.body})
   return await respond(String(url),init,calls.length)
  },
  process:{env:{}},
  require:name=>{
   if(name==='server-only')return {}
   if(name==='./provider-account-access')return {validAccountAccess}
   throw Error('Unexpected dependency in isolated provider probe: '+name)
  }
 }
 runInNewContext(code,sandbox,{timeout:1500,filename:'provider-connection-check.ts'})
 return {service:mod.exports,calls}
}

test('all four real provider probes fail closed with no secrets and ZERO external HTTP requests',async()=>{
 const runtime=isolatedProviderProbe(()=>{throw Error('Unexpected external provider network call')})
 for(const provider of ['sumup','documenso','banking','peppol'])
  assert.equal(await runtime.service.checkProviderConnection(provider,{}),'not_configured')
 assert.equal(runtime.calls.length,0)
})

test('SumUp GET uses documented account-only metadata and handles every auth/network state',async()=>{
 const env={SUMUP_API_KEY:fake,SUMUP_MERCHANT_CODE:'MC000TEST'}
 for(const [code,expected] of [[200,'connected'],[401,'unauthorized'],[403,'unauthorized'],
  [429,'unavailable'],[500,'unavailable']]){
  const p=isolatedProviderProbe(async url=>{
   assert.equal(url,'https://api.sumup.com/v0.1/me')
   return code===200?json({user:'test account'},code):denied(code)
  })
  assert.equal(await p.service.checkProviderConnection('sumup',env),expected)
  assert.equal(p.calls.length,1)
  assert.equal(p.calls[0].method,'GET')
  assert.equal(p.calls[0].headers.Authorization,'Bearer '+fake)
  assert.equal(p.calls[0].redirect,'error')
  assert.equal(p.calls[0].cache,'no-store')
 }
 const offline=isolatedProviderProbe(async()=>{throw Error('Network offline')})
 assert.equal(await offline.service.checkProviderConnection('sumup',env),'unavailable')
 assert.deepEqual(offline.calls.map(x=>x.method),['GET'])
})

test('Documenso v2 probe uses raw API token and rejects local or unsafe origins without requests',async()=>{
 const env={DOCUMENSO_BASE_URL:'https://app.documenso.com',DOCUMENSO_API_KEY:fake}
 const p=isolatedProviderProbe(async url=>{
  assert.equal(url,'https://app.documenso.com/api/v2/envelope?perPage=1')
  return json({data:[]})
 })
 assert.equal(await p.service.checkProviderConnection('documenso',env),'connected')
 assert.equal(p.calls[0].headers.Authorization,fake)
 assert.equal(p.calls[0].method,'GET')
 for(const bad of ['http://app.documenso.com','https://localhost',
   'https://127.0.0.1','https://169.254.1.1','https://192.168.3.4',
   'https://user:password@app.documenso.com','https://app.documenso.com?redirect=/admin']){
  const fail=isolatedProviderProbe(()=>{throw Error('Unsafe URL unexpectedly fetched')})
  assert.equal(await fail.service.checkProviderConnection('documenso',
    {...env,DOCUMENSO_BASE_URL:bad}),'not_configured',bad)
  assert.equal(fail.calls.length,0)
 }
})

test('Ponto OAuth token requires AIS scope and account consent; no transfer endpoint can be touched',async()=>{
 const env={PONTO_CLIENT_ID:fake,PONTO_CLIENT_SECRET:fake}
 const p=isolatedProviderProbe(async url=>{
  if(url==='https://api.myponto.com/oauth2/token')
   return json({access_token:'FAKE-AIS-ACCESS-TOKEN',scope:'ai',token_type:'bearer'})
  if(url==='https://api.myponto.com/accounts?page%5Blimit%5D=1')
   return json({data:[{id:eventId,type:'account',attributes:{iban:'BE123...',balance:5}}]})
  throw Error('Forbidden provider endpoint: '+url)
 })
 assert.equal(await p.service.checkProviderConnection('banking',env),'connected')
 assert.equal(p.calls.length,2)
 assert.deepEqual(p.calls.map(c=>c.method),['POST','GET'])
 assert.equal(p.calls[0].body,'grant_type=client_credentials')
 assert.ok(p.calls[0].headers.Authorization.startsWith('Basic '))
 assert.equal(p.calls[1].headers.Authorization,'Bearer FAKE-AIS-ACCESS-TOKEN')
 assert.ok(p.calls.every(c=>!(/payments|transfers|initiations/i.test(c.url))))
 assert.equal(validAccountAccess({data:[]}), 'needs_account_access')
})

test('Ponto rejects missing scopes, too-short tokens, invalid account data and oversized JSON',async()=>{
 const env={PONTO_CLIENT_ID:fake,PONTO_CLIENT_SECRET:fake}
 for(const token of [
  {access_token:'01234567890123',scope:'pi'},
  {access_token:'short',scope:'ai'},
  {access_token:'01234567890123',scope:''},
  {access_token:'01234567890123',scope:'ais'},
 ]){
  const p=isolatedProviderProbe(async()=>json(token))
  assert.equal(await p.service.checkProviderConnection('banking',env),'unavailable')
  assert.equal(p.calls.length,1,'Invalid token must not invoke bank account API')
 }
 const p=isolatedProviderProbe(async (url)=>{
  if(url.includes('oauth2/token'))return json({access_token:'01234567890123',scope:'ai'})
  return json({data:[]})
 })
 assert.equal(await p.service.checkProviderConnection('banking',env),'needs_account_access')
 const broken=isolatedProviderProbe(async url=>url.includes('oauth2/token')
  ?json({access_token:'01234567890123',scope:'ai'})
  :json({data:[{type:'payment',id:eventId}]}))
 assert.equal(await broken.service.checkProviderConnection('banking',env),'unavailable')
 const oversized=isolatedProviderProbe(async()=>new Response('a'.repeat(18000),{
  headers:{'Content-Length':'18000'},status:200
 }))
 assert.equal(await oversized.service.checkProviderConnection('banking',env),'unavailable')
})

test('Ponto transaction-fetch helper refuses arbitrary URLs, disallowed filters and write paths',async()=>{
 const p=isolatedProviderProbe(async()=>{throw Error('No network expected')})
 const bad=['https://evil.example/accounts?page%5Blimit%5D=1',
  '/payments?page%5Blimit%5D=1',
  '/accounts?page%5Blimit%5D=0',
  '/accounts?page%5Blimit%5D=101',
  '/accounts?page%5Blimit%5D=1&foo=bar',
  '/accounts/'+eventId+'/transactions?page%5Blimit%5D=1&page%5Bafter%5D=../bad']
 for(const input of bad){
  await assert.rejects(p.service.pontoReadOnlyJson(input,'fake-token-123456789'),/ponto_read_denied/,input)
 }
 assert.equal(p.calls.length,0)
})

test('Billit sandbox uses read-only orders GET and correct headers; no Peppol invoice sent',async()=>{
 const env={BILLIT_SANDBOX_PARTY_ID:'1234567',BILLIT_SANDBOX_API_KEY:fake}
 for(const [code,expected] of [[200,'connected'],[401,'unauthorized'],[403,'unauthorized'],
  [502,'unavailable']]){
  const p=isolatedProviderProbe(async url=>{
   assert.equal(url,'https://api.sandbox.billit.be/v1/orders')
   return code===200?json({value:[]},code):denied(code)
  })
  assert.equal(await p.service.checkProviderConnection('peppol',env),expected)
  assert.equal(p.calls.length,1)
  assert.equal(p.calls[0].method,'GET')
  assert.equal(p.calls[0].headers.PartyID,'1234567')
  assert.equal(p.calls[0].headers.ApiKey,fake)
 }
 const invalid=isolatedProviderProbe(()=>{throw Error('Bad PartyID must be rejected locally')})
 assert.equal(await invalid.service.checkProviderConnection('peppol',
  {...env,BILLIT_SANDBOX_PARTY_ID:'abc'}),'not_configured')
 assert.equal(invalid.calls.length,0)
})

test('Weeztix barcode and workpost checks reject URL injection, wrong post and scanning without vendor confirmation',()=>{
 for(const post of ['Ticket scan','Inkom','Entrée','Eingang','Ticket scanning'])
  assert.equal(isEntranceWorkplace(post),true,post)
 for(const post of ['Bar','Merch','Backstage','Stage managers','Tokens'])
  assert.equal(isEntranceWorkplace(post),false,post)
 for(const value of ['https://evil.example/ticket','../ticket','', ' ABC123',
  'a'.repeat(161),'a'.repeat(5),'<script>x</script>'])
  assert.equal(validWeeztixBarcode(value),false,value)
 assert.equal(validWeeztixBarcode('TICKET-ABC123'),true)
 const route=read('app/api/weeztix/scan/route.ts')
 assert.match(route,/WEEZTIX_SCANNING_ENABLED!=="true"/)
 assert.match(route,/WEEZTIX_ACTIVE_EVENT_ID!==eventId/)
 assert.match(route,/if\(response.status===204\)return NextResponse.json\(\{ok:true,code:"admitted"\}/)
 assert.match(route,/if\(response.status===400\)return fail\("provider_rejected",409\)/)
 assert.match(route,/if\(response.status===404\)return fail\("ticket_not_found",404\)/)
 assert.match(route,/if\(response.status===429\)return fail\("provider_busy",503\)/)
 assert.match(route,/getScopedWeeztixConnection/)
 assert.match(route,/requestHasSameOrigin\(request\)/)
})

test('Weeztix OAuth requires valid Bearer response and ignores malformed or expired input',()=>{
 const valid={token_type:'Bearer',access_token:'TESTACCESS-1234567',
   refresh_token:'TESTREFRESH-1234567',expires_in:3600}
 const token=parseWeeztixOAuthTokenResponse(valid,1700000000000)
 assert.equal(token.WEEZTIX_TOKEN_EXPIRES_AT,String(1700000000+3600-30))
 for(const input of [
  {...valid,token_type:'bearer'},
  {...valid,expires_in:-10},
  {...valid,expires_in:30},
  {...valid,expires_in:1.5},
  {...valid,access_token:'short'},
  {...valid,refresh_token:'short'},
  {...valid,access_token:'a\nb'},
  null,{},[],
 ])assert.equal(parseWeeztixOAuthTokenResponse(input),null)
})

test('EventPay imported Bar + Merch payments, refund and top-up are reconciled without counting card credit as revenue',()=>{
 const csv=header+record('BAR-A','bar','ORDER-A','3.50')
  +record('MERCH-A','merch','ORDER-B','16.75')
  +record('TOPUP-A','topups','LOAD-A','20.00')
  +record('BAR-REFUND','bar','ORDER-A','1.50','refunded')
 const parsed=validateProviderTransactionCsv(csv,eventId,externalEvent,500,'eventpay')
 assert.deepEqual(parsed.errors,[])
 assert.equal(parsed.paidCents,4025)
 assert.equal(parsed.refundedCents,150)
 const rows=parsed.rows.map(row=>({...row,provider:'eventpay'}))
 const report=buildSalesReconciliationReport(rows)
 assert.equal(report.totals.bar,200)
 assert.equal(report.totals.merch,1675)
 assert.equal(report.totals.topups,2000)
 assert.equal(report.totals.bar+report.totals.merch,1875)
 assert.equal(report.acceptedCount,4)
})

test('all-or-nothing EventPay CSV rejects wrong event, charge replay, unsafe amount and malicious spreadsheet data',()=>{
 const base=record('BAR-A','bar','ORDER-A','3.50')
 const bad=[
  record('OTHER','bar','ORDER-B','3.00','paid','wrong-event'),
  record('BAR-A','bar','ORDER-A','3.50'),
  record('FORMULA','bar','=HYPERLINK','3.00'),
  record('USD','bar','ORDER-C','3.00').replace(',EUR,',',USD,'),
  record('NEG','bar','ORDER-D','-3.00'),
  record('BADDATE','bar','ORDER-E','3.00').replace('2026-11-17','2026-02-30'),
  record('TICKETS','tickets','ORDER-F','3.00'),
 ]
 for(const line of bad){
  const parsed=validateProviderTransactionCsv(header+base+line,eventId,externalEvent,500,'eventpay')
  assert.ok(parsed.errors.length>0,line)
  assert.equal(parsed.rows.length,0,'No partial import is permitted')
  assert.equal(parsed.paidCents,0)
 }
 assert.ok(validateProviderTransactionCsv(header+base,eventId,externalEvent,0,'eventpay').errors.length)
 assert.ok(validateProviderTransactionCsv(header+'x'.repeat(1_000_100),eventId,externalEvent,500,'eventpay').errors.length)
})

test('cross-event mapping is explicit, and card-reload settlement cannot be misclassified as SumUp payouts',()=>{
 const mapping=[{provider:'eventpay',externalEventId:externalEvent,eventId,enabled:false}]
 assert.equal(resolveProviderEvent('eventpay',externalEvent,mapping),null)
 assert.equal(resolveProviderEvent('eventpay',externalEvent,[{...mapping[0],enabled:true}]),eventId)
 assert.equal(resolveProviderEvent('sumup',externalEvent,[{...mapping[0],enabled:true}]),null)
 assert.equal(resolveProviderEvent('eventpay','other',[{...mapping[0],enabled:true}]),null)
 const settlementRow={id:eventId,event_id:eventId,provider:'sumup',
   transaction_id:'SET-1',status:'paid',amount_cents:1000}
 assert.equal(previewProviderSettlement([settlementRow],100)?.payoutCents,900)
 assert.equal(previewProviderSettlement([{...settlementRow,provider:'eventpay'}],100),null)
 assert.equal(previewProviderSettlement([{...settlementRow,event_id:secondEventId},
   settlementRow],100),null)
 assert.equal(previewProviderSettlement([settlementRow],1000),null)
})
