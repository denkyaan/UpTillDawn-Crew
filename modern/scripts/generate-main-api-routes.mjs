import {writeFileSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {filesBelow,parse,root,ts} from '../tooling/main-source.mjs'
const entries=filesBelow('app').filter(f=>f.endsWith('/route.ts')).map(file=>{
 const source=parse(file)
 const methods=source.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).map(n=>n.name?.text).filter(n=>['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(n))
 const pattern='/'+file.replace(/^app\//,'').replace(/\/route\.ts$/,'').split('/').filter(x=>!/^\([^)]*\)$/.test(x)).map(x=>x.startsWith('[')?'[^/]+':x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')
 return {pattern,methods}
}).filter(x=>x.methods.length)
const output='// Generated from original Main API route declarations. No arbitrary proxy.\nexport const originalMainRoutes='+JSON.stringify(entries,null,1)+' as const\n'
const file=resolve(root,'modern/src/api/main-routes.ts')
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==output)throw Error('Stale original Main API route allowlist')}else writeFileSync(file,output)
console.log(JSON.stringify({originalApiRoutes:entries.length}))
