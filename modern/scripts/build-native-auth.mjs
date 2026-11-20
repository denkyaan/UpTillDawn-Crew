// Build original API/actions as server-only Worker code, without Next or React.
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const root=resolve(import.meta.dirname,'../..'),require=createRequire(import.meta.url),ts=require('typescript')
const output=resolve(root,'modern/src/api/native-auth.generated.mjs')
const routes={'/api/auth/portal-login':'app/api/auth/portal-login/route.ts','/api/auth/account-action':'app/api/auth/account-action/route.ts','/auth/callback':'app/auth/callback/route.ts'}
const allowed=new Set(['NODE_ENV','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_APP_URL','RESEND_API_KEY','SECURITY_ALERT_EMAIL','SECURITY_FROM_EMAIL','GEOAPIFY_API_KEY','UPT_MIGRATION_EMAIL_CALLBACK_READY'])
const contextNames=new Set(['next/server','next/headers','next/cache','next/navigation','next/dist/client/components/redirect-error','react','native-auth-runtime:context'])
const entry=Object.entries(routes).map(([,file],i)=>`import * as route${i} from ${JSON.stringify(resolve(root,file))};`).join('\n')+`\nexport async function executeOriginalAuth(request){const path=new URL(request.url).pathname;${Object.keys(routes).map((path,i)=>`if(path===${JSON.stringify(path)}){const handler=route${i}[request.method];return handler?handler(request):Response.json({error:'method_not_allowed'},{status:405});}`).join('')}return Response.json({error:'not_found'},{status:404})}`
const processed=[]
await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,loader:'js'},outfile:output,bundle:true,format:'esm',platform:'neutral',target:'es2022',conditions:['workerd','worker','browser'],minify:false,legalComments:'none',external:['@supabase/ssr','@supabase/supabase-js'],plugins:[{
 name:'original-native-auth-source',setup(builder){
  builder.onResolve({filter:/.*/},args=>{
   if(contextNames.has(args.path))return {path:'./native-auth-context.ts',external:true}
   if(args.path==='server-only')return {path:'server-only',namespace:'native-empty'}
   if(args.path.startsWith('@/'))return {path:resolve(root,args.path.slice(2))+(args.path.endsWith('.ts')?'':'.ts')}
  })
  builder.onLoad({filter:/.*/,namespace:'native-empty'},()=>({contents:'',loader:'js'}))
  builder.onLoad({filter:/\.ts$/},args=>{
   if(!args.path.startsWith(root+'/lib/')&&!args.path.startsWith(root+'/app/'))return
   const source=readFileSync(args.path,'utf8'),ast=ts.createSourceFile(args.path,source,ts.ScriptTarget.Latest,true),f=ts.factory
   let usesEnv=false
   const result=ts.transform(ast,[ctx=>{
    const visit=node=>{
     if(ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==='process.env'&&!allowed.has(node.name.text))throw Error('Unaudited native authentication env: '+node.name.text)
     if(ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==='process'&&node.name.text==='env'){usesEnv=true;return f.createCallExpression(f.createIdentifier('__nativeEnvironment'),undefined,[])}
     return ts.visitEachChild(node,visit,ctx)
    };return node=>ts.visitNode(node,visit)
   }])
   const text=(usesEnv?'import {nativeEnvironment as __nativeEnvironment} from "native-auth-runtime:context";\n':'')+ts.createPrinter().printFile(result.transformed[0]);result.dispose();processed.push(args.path.slice(root.length+1))
   return {contents:text,loader:'ts',resolveDir:dirname(args.path)}
  })
 }
}]})
const code=readFileSync(output,'utf8')
if(/(?:from|import\s*\()\s*['"](?:next(?:\/|['"])|react|server-only)|process\.env/.test(code))throw Error('Framework authentication runtime dependency remains')
writeFileSync(output,'// Generated from original Main authentication sources. Server Worker only.\n'+code)
console.log(JSON.stringify({originalAuthRoutes:Object.keys(routes).length,sourceModules:processed.length,frameworkRuntime:false}))
