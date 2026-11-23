// Deterministic source-to-Worker endpoint inventory, NOT a release pass.
// Unlike a count of 64 route files, checks original METHOD/path pairs and
// explicitly identifies service-binding fallback and auth/cutover flags.
// Uses TypeScript AST so dynamic Hono registrations are counted accurately.
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import ts from "typescript"

const here=new URL("../",import.meta.url)
const content=relative=>readFileSync(new URL(relative,here),"utf8")
const legacy=content("src/api/main-routes.ts")
const originalSource=legacy.match(/export const originalMainRoutes=\[([\s\S]*?)\] as const/)
if(!originalSource)throw Error("Missing original API source registry")
const original=JSON.parse("["+originalSource[1]+"]")
const workerText=content("src/api/worker.ts")
const file=ts.createSourceFile("worker.ts",workerText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
const native=[]
const methods=new Set(["get","post","put","patch","delete"])
function unwrap(node){return ts.isAsExpression(node)?unwrap(node.expression):node}
function push(method,path){
 if(typeof path!=="string"||!path.startsWith("/"))throw Error("Unexpected candidate route")
 if(!native.some(x=>x.method===method&&x.path===path))native.push({method,path})
}
function direct(node){
 if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||
    !ts.isIdentifier(node.expression.expression)||node.expression.expression.text!=="app")
  return null
 const method=node.expression.name.text.toLowerCase()
 if(!methods.has(method)||!node.arguments.length)return null
 const arg=node.arguments[0]
 return {method,path:ts.isStringLiteral(arg)?arg.text:null,
  ident:ts.isIdentifier(arg)?arg.text:null}
}
function visit(node){
 const call=direct(node)
 if(call?.path)push(call.method,call.path)
 if(ts.isForOfStatement(node)){
  const expression=unwrap(node.expression)
  if(ts.isArrayLiteralExpression(expression)){
   const referenced=[]
   const collect=part=>{
    const d=direct(part)
    if(d?.ident)referenced.push(d)
    ts.forEachChild(part,collect)
   }
   collect(node.statement)
   for(const row of expression.elements){
    const resolved=unwrap(row)
    const path=ts.isStringLiteral(resolved)?resolved.text:
     ts.isArrayLiteralExpression(resolved)&&ts.isStringLiteral(resolved.elements[0])?
       resolved.elements[0].text:null
    if(!path)continue
    for(const call of referenced)push(call.method,path)
   }
  }
 }
 ts.forEachChild(node,visit)
}
visit(file)
const paramSample="11111111-1111-4111-8111-111111111111"
function nativeMatches(pattern,route){
 const candidate=route.replace(/:[a-zA-Z0-9_]+/g,paramSample)
 return new RegExp("^"+pattern+"$").test(candidate)
}
const inherited=original.flatMap(item=>item.methods.map(method=>{
 const m=native.find(x=>x.method===method&&nativeMatches(item.pattern,x.path))
 let delivery="legacy-proxy"
 if(m){
  delivery="native"
  if(m.path==="/api/migration/view-data")delivery="mixed-legacy-view"
  if(m.path==="/api/geocode/autocomplete")delivery="conditional-legacy-provider"
  if(m.path.startsWith("/api/auth/")||m.path==="/auth/callback")delivery="legacy-auth-default"
 }
 if(item.pattern==="/api/test-auth-session")delivery="intentionally-denied"
 return {method,pattern:item.pattern,nativePath:m?.path||null,delivery}
}))
const pending=inherited.filter(x=>x.delivery!=="native"&&x.delivery!=="intentionally-denied")
const migrated=inherited.filter(x=>x.delivery==="native")
const report={
 contract:"uptilldawn-source-to-hono-route-method-inventory-v1",
 originalSourceRoutes:original.length,
 originalMethodPairs:inherited.length,
 explicitWorkerMethodPairs:native.length,
 nativeMethodPairs:migrated.length,
 pendingLegacyMethodPairs:pending.length,
 pendingLegacyAuthentication:pending.filter(x=>x.delivery==="legacy-auth-default").length,
 pendingMixedOrConditional:pending.filter(x=>x.delivery.includes("legacy")).length,
 deniedBySecurity:inherited.filter(x=>x.delivery==="intentionally-denied").length,
 allOriginalPairsAccountedFor:inherited.length===
  migrated.length+pending.length+inherited.filter(x=>x.delivery==="intentionally-denied").length,
 fullCutoverAllowed:false,
 pending:pending.map(x=>x.method+" "+x.pattern+" ["+x.delivery+"]")
}
export {report,native,inherited}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 console.log(JSON.stringify(report,null,2))
 if(process.argv.includes("--enforce-independent")&&pending.length)process.exitCode=1
}
