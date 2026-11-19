import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
let ts
try{ts=createRequire(resolve(root,'package.json'))('typescript')}catch{ts=require('typescript')}
export const prefix='main-source/'
export function sourceFile(path){
 const full=resolve(root,path)
 if(!full.startsWith(root+'/'))throw Error('Source outside repository')
 return ['', '.ts','.tsx','.js','/index.ts','/index.tsx'].map(s=>full+s).find(p=>existsSync(p)&&statSync(p).isFile())
}
export function filesBelow(dir){return readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(x=>x.isDirectory()?filesBelow(dir+'/'+x.name):[dir+'/'+x.name])}
export const pages=filesBelow('app/(app)').filter(p=>p.endsWith('/page.tsx')).concat(['app/maker-mode/page.tsx','app/god-mode/page.tsx','app/god-mode/login/page.tsx','app/god-mode/setup/page.tsx','app/qr/page.tsx','app/q/[code]/page.tsx'])
export function routePath(file){return '/'+file.replace(/^app\//,'').replace(/\([^/]+\)\//g,'').replace(/\/page\.tsx$/,'').replace(/^page\.tsx$/,'').replace(/\[([^\]]+)\]/g,':$1')}
export function parse(file,source=readFileSync(resolve(root,file),'utf8')){return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS)}
export const directive=(node,value)=>Boolean(node.body&&ts.isBlock(node.body)&&node.body.statements.some(s=>ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text===value))
export const isAction=node=>ts.isFunctionDeclaration(node)&&directive(node,'use server')
const isExport=node=>node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)
export function exportedActions(file){
 const ast=parse(file)
 if(!ast.statements.some(s=>ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text==='use server'))return []
 return ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&isExport(s)&&s.name).map(s=>s.name.text)
}
const privateAuth=new Set(['signUp','signIn','signInAdmin','signOut','forgotPassword','updatePassword','resendVerificationEmail','verifyAdminSettingsCode'])
export function actionEntries(){
 const library=filesBelow('lib/actions').filter(f=>f.endsWith('.ts')&&!f.includes('god-mode-login')).flatMap(file=>exportedActions(file).filter(name=>file!=='lib/actions/auth.ts'||!privateAuth.has(name)).map(name=>({id:file+'#'+name,file,name})))
 const inline=filesBelow('app/(app)').concat(filesBelow('components')).filter(f=>/\.tsx?$/.test(f)).flatMap(file=>parse(file).statements.filter(isAction).map(s=>({id:file+'#'+s.name.text,file,name:s.name.text,inline:true})))
 return library.concat(inline)
}
const adapters={
 'node:crypto':'src/compat/crypto.ts',
 '@/lib/administration/contract-signing-operator-preflight':'src/compat/signing-preflight.ts',
 'next/link':'src/compat/link.tsx','next/image':'src/compat/image.tsx','next/navigation':'src/compat/navigation.ts',
 'next/dynamic':'src/compat/dynamic.tsx','next/headers':'src/compat/headers.ts','next/cache':'src/compat/cache.ts',
 '@/lib/actions/auth':'src/compat/auth-actions.ts','@/lib/supabase/crew-server':'src/compat/crew-browser.ts',
 '@/lib/supabase/crew-client':'src/compat/crew-client.ts','@/lib/server-locale':'src/compat/server-locale.ts',
 '@/lib/administration/external-services-view-data':'src/compat/external-services-view-data.ts',
 '@/lib/administration/documenso':'src/compat/documenso.ts',
}
// These modules contain only ordinary signed-user/RLS reads and pure validation.
// Every other server-only import fails the build instead of entering a browser.
const browserSafeServerModules=new Set(['lib/administration/page-access.ts','lib/administration/access.ts','lib/administration/integration-management-access.ts','lib/administration/peppol-server.ts'])
function target(spec,file){
 if(adapters[spec])return resolve(root,'modern',adapters[spec])
 if(spec.startsWith('@/')||spec.startsWith('.')){
  const path=spec.startsWith('@/')?spec.slice(2):relative(root,resolve(root,dirname(file),spec))
  const full=sourceFile(path)
  if(full)return /\.[cm]?[tj]sx?$/.test(full)?prefix+relative(root,full):full
 }
 return spec
}
function hasJsx(node){let found=false;function walk(n){if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n))found=true;else ts.forEachChild(n,walk)}walk(node);return found}
export function clientSource(file){
 const ast=parse(file),f=ts.factory
 const serverModule=ast.statements.some(s=>ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text==='use server')
 if(serverModule){
  const exports=exportedActions(file)
  return `import {invokeOriginalAction} from ${JSON.stringify(resolve(root,'modern/src/original/transport.ts'))};\n`+exports.map(name=>`export const ${name}=(...args)=>invokeOriginalAction(${JSON.stringify(file+'#'+name)},args);`).join('\n')
 }
 const clientModule=ast.statements.some(s=>ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text==='use client')
 const viewIds=new Set(ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&s.name&&/^[A-Z]/.test(s.name.text)&&!clientModule&&(s.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)||s.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)&&s.body?.statements.some(n=>ts.isReturnStatement(n)&&n.expression&&ts.isCallExpression(n.expression)))).map(s=>s.name.text))
 let usesView=false,usesAction=false,usesLoad=false,usesRead=false,usesDate=false
 function rewrite(context){
  function visit(node){
   if(ts.isExpressionStatement(node)&&ts.isStringLiteral(node.expression)&&node.expression.text==='use client')return undefined
   if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='server-only'){
    if(!browserSafeServerModules.has(file))throw Error('Private server module blocked from candidate: '+file)
    return undefined
   }
   if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier))return f.updateImportDeclaration(node,node.modifiers,node.importClause,f.createStringLiteral(target(node.moduleSpecifier.text,file)),node.attributes)
   if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(node.arguments[0]))return f.updateCallExpression(node,node.expression,node.typeArguments,[f.createStringLiteral(target(node.arguments[0].text,file)),...node.arguments.slice(1)])
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='externalServicesReadiness'&&node.arguments[0]?.getText(ast)==='process.env'){
    usesRead=true
    const workspace=file==='app/(app)/sales/page.tsx'?f.createStringLiteral('sales'):file==='app/(app)/portals/administration/modules/[slug]/page.tsx'?f.createIdentifier('slug'):null
    if(!workspace)throw Error('Unreviewed integration readiness context: '+file)
    return f.createAwaitExpression(f.createCallExpression(f.createIdentifier('__originalRead'),undefined,[f.createStringLiteral('external-services'),f.createArrayLiteralExpression([workspace])]))
   }
   if(ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==='process.env'){
    const name=node.name.text
    if(name==='NODE_ENV')return f.createStringLiteral('production')
    if(name.startsWith('NEXT_PUBLIC_')){
     if(name==='NEXT_PUBLIC_SUPABASE_URL')return f.createStringLiteral('https://npbjrtiolqperdgljnhi.supabase.co')
     if(name==='NEXT_PUBLIC_APP_URL')return f.createStringLiteral('https://uptilldawn-modern-main.uptilldawn.workers.dev')
     throw Error('Unmapped public environment variable: '+file+':'+name)
    }
    if(name==='UPT_E2E_SESSION_BRIDGE')return f.createIdentifier('undefined')
    throw Error('Private environment variable blocked: '+file+':'+name)
   }
   if((ts.isFunctionDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node))&&directive(node,'use server')&&(!isAction(node)||node.parent!==ast))throw Error('Inline closure requires an explicit server adapter: '+file)
   if(isAction(node)){
    usesAction=true
    return f.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,f.createBlock([f.createReturnStatement(f.createCallExpression(f.createIdentifier('__originalAction'),undefined,[f.createStringLiteral(file+'#'+node.name.text),f.createArrayLiteralExpression(node.parameters.map(p=>f.createIdentifier(p.name.getText(ast))))]))],true))
   }
   if(ts.isFunctionDeclaration(node)&&node.name&&viewIds.has(node.name.text)){
    usesView=true
    const impl=f.createFunctionExpression(node.modifiers?.filter(m=>m.kind===ts.SyntaxKind.AsyncKeyword),node.asteriskToken,f.createIdentifier(node.name.text+'Source'),node.typeParameters,node.parameters,node.type,ts.visitEachChild(node.body,visit,context))
    const value=f.createCallExpression(f.createIdentifier('__originalView'),undefined,[f.createStringLiteral(file+'#'+node.name.text),impl])
    const declaration=f.createVariableStatement(node.modifiers?.filter(m=>m.kind===ts.SyntaxKind.ExportKeyword),f.createVariableDeclarationList([f.createVariableDeclaration(node.name,undefined,undefined,value)],ts.NodeFlags.Const))
    return node.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)?[declaration,f.createExportAssignment(undefined,false,node.name)]:declaration
   }
   if(!clientModule&&(file.startsWith('app/')||viewIds.size>0)){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['toLocaleString','toLocaleDateString','toLocaleTimeString'].includes(node.expression.name.text)){
     usesDate=true
     return f.createCallExpression(f.createIdentifier('__originalDateString'),undefined,[ts.visitNode(node.expression.expression,visit),f.createStringLiteral(node.expression.name.text),...node.arguments.map(a=>ts.visitNode(a,visit))])
    }
    if(ts.isNewExpression(node)&&node.expression.getText(ast)==='Intl.DateTimeFormat'){
     usesDate=true
     return f.createCallExpression(f.createIdentifier('__originalDateTimeFormat'),undefined,(node.arguments??[]).map(a=>ts.visitNode(a,visit)))
    }
   }
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text)&&!clientModule){
    usesLoad=true
    return f.createCallExpression(f.createIdentifier('__loadOriginalView'),node.typeArguments,[node.expression,...node.arguments.map(a=>ts.visitNode(a,visit))])
   }
   return ts.visitEachChild(node,visit,context)
  }
  return node=>ts.visitNode(node,visit)
 }
 const transformed=ts.transform(ast,[rewrite]);let printed=ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose()
 const imports=[]
 if(usesDate)imports.push(`import {originalDateString as __originalDateString,originalDateTimeFormat as __originalDateTimeFormat} from ${JSON.stringify(resolve(root,'modern/src/compat/server-date.ts'))};`)
 if(usesView||usesLoad)imports.push(`import {${[usesView?'sourceView as __originalView':null,usesLoad?'loadSourceView as __loadOriginalView':null].filter(Boolean).join(',')}} from ${JSON.stringify(resolve(root,'modern/src/original/runtime.tsx'))};`)
 if(usesAction||usesRead)imports.push(`import {${[usesAction?'invokeOriginalAction as __originalAction':null,usesRead?'invokeOriginalRead as __originalRead':null].filter(Boolean).join(',')}} from ${JSON.stringify(resolve(root,'modern/src/original/transport.ts'))};`)
 printed=imports.join('\n')+'\n'+printed
 const js=ts.transpileModule(printed,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}}).outputText
 if(/process\.env|(?:from|import\s*\()\s*['"](?:node:|server-only)/.test(js))throw Error('Private runtime dependency blocked: '+file)
 return js
}
export function mainSourcePlugin(){
 return {name:'authoritative-main-source',enforce:'pre',resolveId(id){if(id.startsWith(prefix))return '\0'+id},load(id){
  if(id==='\0main-source/routes')return 'export const routes=['+pages.map(file=>`{path:${JSON.stringify(routePath(file))},load:()=>import(${JSON.stringify(prefix+file)})}`).join(',')+'];'
  if(id.startsWith('\0'+prefix))return {code:clientSource(id.slice(prefix.length+1)),map:null}
 }}
}
export {ts}
