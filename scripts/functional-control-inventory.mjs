import {readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {join,relative} from 'node:path'

const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])
const sources=walk('app').concat(walk('components')).filter(p=>/\.(tsx|jsx)$/.test(p))
const tests=walk('tests').filter(p=>/\.test\.mjs$/.test(p))
const browser=readFileSync('scripts/15-bot-browser-test.mjs','utf8')
const routeFiles=sources.filter(p=>/\/page\.tsx$/.test(p))
const controls=[]
for(const file of sources){
 const src=readFileSync(file,'utf8')
 const tags=[...src.matchAll(/<(button|Button|a|Link|input|select|textarea|form)\b/g)]
 for(const match of tags){
  const line=src.slice(0,match.index).split('\n').length
  const opening=src.slice(match.index,src.indexOf('>',match.index)+1).slice(0,450)
  controls.push({file:relative('.',file),line,kind:match[1],hasHandler:/onClick|onChange|onSubmit|href=|action=|type=['"]submit/.test(opening)})
 }
}
const routes=routeFiles.map(file=>({file:relative('.',file),route:'/'+relative('app',file).replace(/\([^)]*\)\//g,'').replace(/\/page\.tsx$/,'').replace(/^page\.tsx$/,'').replace(/\[(\w+)\]/g,':$1')}))
const roleNames=['admin','responsible','staff','administration','promotion','maker']
const testNames=tests.map(p=>p.toLowerCase())
const roleCoverage=roleNames.map(role=>({role,hasDedicatedTest:testNames.some(p=>p.includes(role)),inBrowserSuite:new RegExp('\\b'+role+'\\b','i').test(browser)}))
const report={generatedAt:new Date().toISOString(),note:'Static inventory, not proof of interactive behavior. Only authenticated browser interactions plus persistence and real staging evidence can establish functioning controls.',routeCount:routes.length,controlCount:controls.length,controlKinds:Object.fromEntries([...new Set(controls.map(x=>x.kind))].map(k=>[k,controls.filter(x=>x.kind===k).length])),controlsWithoutInlineHandler:controls.filter(x=>!x.hasHandler).length,roleCoverage,routes,controls}
mkdirSync('artifacts',{recursive:true})
writeFileSync('artifacts/functional-control-inventory.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({routeCount:report.routeCount,controlCount:report.controlCount,controlsWithoutInlineHandler:report.controlsWithoutInlineHandler,roleCoverage},null,2))
