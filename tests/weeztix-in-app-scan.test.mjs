import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {validWeeztixBarcode} from "../lib/weeztix-scanner.ts"
import {externalServicesReadiness} from "../lib/administration/external-services-readiness.ts"
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("ticket input is bounded and rejects URL/HTML and control chars",()=>{
 for(const code of ["ABCDEF","TICKET-12345","TTZ2PM9NGRJXAUTWHHW","ticket_1234"])assert.equal(validWeeztixBarcode(code),true,code)
 for(const code of ["","ab","https://weeztix.com/a","ABC%2FDEF","ABC DEF","<script>","test\nnewline","x".repeat(161),null,12])assert.equal(validWeeztixBarcode(code),false,String(code))
})

test("native in-app scanner decodes local JS QR and never approves without authoritative server scan",()=>{
 const ui=read("components/crew/weeztix-scanner-panel.tsx")
 const page=read("app/(app)/workplaces/page.tsx")
 for(const token of ['getUserMedia','jsqr-1.4.0.js','/api/weeztix/scan','playsInline','video.current.srcObject','cameraActive','result.ok','cache:"no-store"'])assert.ok(ui.includes(token),token)
 assert.match(ui,/res\.ok&&data\?\.code==="admitted"&&data\?\.ok===true/)
 assert.match(ui,/fetch\("\/api\/weeztix\/scan"/)
 assert.match(ui,/provider_unavailable/)
 assert.match(page,/isEntranceWorkplace\(workplace\.name\)&&<WeeztixScannerPanel/)
 assert.match(page,/eventId=\{workplace\.event_id\} workplaceId=\{workplace\.id\}/)
 for(const locale of ["nl:","fr:","en:","de:"])assert.ok(ui.includes(locale))
 const license=read("public/vendor/jsqr-1.4.0.LICENSE")
 assert.match(license,/Apache License/)
})

test("Weeztix online admission route checks event/workplace/shift authority before provider calls",()=>{
 const api=read("app/api/weeztix/scan/route.ts")
 for(const check of ['requestHasSameOrigin','getCurrentUser','account_blocked','isEntranceWorkplace(workplace.name)','responsible_assignments','from("shifts")','eq("event_id",eventId)','eq("workplace_id",workplaceId)','WEEZTIX_SCANNING_ENABLED','WEEZTIX_ACTIVE_EVENT_ID','WEEZTIX_ACCESS_TOKEN','validWeeztixBarcode','Cache-Control','AbortSignal.timeout'])assert.ok(api.includes(check),check)
 assert.match(api,/https:\/\/api\.weeztix\.com\/order\/scanbarcode\//)
 assert.match(api,/response\.status===204/)
 assert.match(api,/return fail\("not_configured",503\)/)
 assert.doesNotMatch(api,/WEEZTIX_ACCESS_TOKEN.*NextResponse|data\.token|return.*access_token/)
 assert.doesNotMatch(api,/catch\s*\{\s*return NextResponse\.json\(\{ok:true/)
})

test("integration status remains cautious: key presence is not a successful live provider check",()=>{
 const plain=externalServicesReadiness({})
 assert.equal(plain.find(x=>x.id==="weeztix")?.state,"manual_available")
 assert.equal(plain.find(x=>x.id==="peppol")?.state,"provider_required")
 const configured=externalServicesReadiness({WEEZTIX_SCANNING_ENABLED:"true",WEEZTIX_ACCESS_TOKEN:"synthetic",WEEZTIX_ACTIVE_EVENT_ID:"00000000-0000-0000-0000-000000000000",BILLIT_SANDBOX_PARTY_ID:"synthetic",BILLIT_SANDBOX_API_KEY:"synthetic",SUMUP_MERCHANT_CODE:"synthetic",SUMUP_API_KEY:"synthetic",PONTO_CLIENT_ID:"synthetic",PONTO_CLIENT_SECRET:"synthetic"})
 for(const name of ["weeztix","peppol","sumup","banking"])assert.equal(configured.find(x=>x.id===name)?.state,"credentials_present",name)
 assert.equal(externalServicesReadiness({WEEZTIX_ACCESS_TOKEN:"synthetic"}).find(x=>x.id==="weeztix")?.state,"manual_available")
})
