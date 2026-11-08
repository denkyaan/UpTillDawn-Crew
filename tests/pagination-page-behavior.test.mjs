// Execute the actual server pages with a read-only in-memory Supabase client.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {listPage,escapeLikeSearch} from '../lib/list-query.ts'
import {administrationModules,administrationCopy} from '../lib/administration/modules.ts'
import {administrationWorkspaceIntro} from '../lib/administration/workspace-copy.ts'
import {invoiceStatuses,invoiceStatusLabels,isOverdueInvoice} from '../lib/administration/invoice-status.ts'

const nodeRequire=createRequire(import.meta.url)
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const user={id:userId,approved:true,account_blocked:false,isOwner:false,isAdmin:true,realIsAdmin:true}
function database(target){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
  rpc:name=>name==='upt_admin_promotion_task_members'?{order(){return this},range:async()=>({data:[],error:null,count:0})}:Promise.resolve({data:name==='upt_promotion_is_blocked'?false:name==='upt_notification_badge_count'?0:[],error:null}),
  from:table=>{
   const operations=[]
   const query=new Proxy({}, {get(_target,key){
    if(key==='then')return resolve=>{
     const range=operations.find(([name])=>name==='range')
     const start=range?.[1]??0
     const data=table===target&&range?Array.from({length:range[2]-start+1},(_,n)=>{
      const index=start+n
      return {id:'00000000-0000-4000-8000-'+String(index).padStart(12,'0'),name:'Item '+index,title:'Item '+index,description:'Details',kind:'supplier',event_id:null,status:'NOT STARTED',created_at:'2026-11-07T10:00:00Z',user_id:userId,read_at:null,link:null,tasks:{id:'task-'+index,title:'Item '+index,description:'Details',event_id:null}}
     }):[]
     return Promise.resolve({data,error:null,count:table===target?1000:0}).then(resolve)
    }
    return (...args)=>{operations.push([key,...args]);calls.push({table,method:key,args});return query}
   }})
   return query
  },
 }
 return {db,calls}
}
function loadPage(path,db){
 const source=readFileSync(path,'utf8')
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 const moduleExports={exports:{}}
 const mocks={
  '@/lib/list-query':{listPage,escapeLikeSearch},
  '@/lib/actions/auth':{getCurrentUser:async()=>user},
  '@/lib/supabase/crew-server':{createClient:async()=>db},
  '@/lib/server-locale':{requestUiLocale:async()=> 'en'},
  '@/lib/administration/modules':{administrationModules,administrationCopy},
  '@/lib/administration/workspace-copy':{administrationWorkspaceIntro},
  '@/lib/administration/invoice-status':{invoiceStatuses,invoiceStatusLabels,isOverdueInvoice},
  '@/lib/administration/workflow-links':{administrationWorkflowHref:()=>null},
  '@/lib/portal-access':{canOpenPortal:()=>true},
  '@/lib/administration/invoice-filter-validation':{invoiceDateRange:()=>({from:'',to:''})},
  '@/lib/administration/navigation':{administrationNotificationHref:value=>value},
  'next/navigation':{redirect:path=>{throw Error('Unexpected redirect '+path)},notFound:()=>{throw Error('Unexpected 404')}},
 }
 const stub=()=>null
 const require=name=>{
  if(mocks[name])return mocks[name]
  if(name.startsWith('@/components/')||name==='next/link')return {__esModule:true,default:stub}
  if(name.startsWith('@/'))return new Proxy({},{get:()=>value=>value})
  return nodeRequire(name)
 }
 runInNewContext(compiled,{exports:moduleExports.exports,module:moduleExports,require,console,URL,URLSearchParams,FormData,Date,Intl,Buffer,File})
 return moduleExports.exports.default
}
function elements(node){
 if(!node||typeof node!=='object')return []
 if(Array.isArray(node))return node.flatMap(elements)
 return [node,...elements(node.props?.children)]
}
const directory='app/(app)/portals/'

for(const scenario of [
 {name:'counterparty directory',path:directory+'administration/counterparties/page.tsx',table:'admin_counterparties',params:{page:'2',q:'100%_crew',kind:'supplier'},start:50},
 {name:'promotion administration',path:directory+'administration/promotion-tasks/page.tsx',table:'tasks',params:{page:'2',q:'100%_crew'},start:50},
 {name:'shared notification inbox',path:'app/(app)/notifications/page.tsx',table:'crew_notifications',params:{page:'2'},start:50},
 {name:'promotion assignment list',path:directory+'promotion/tasks/page.tsx',table:'task_assignments',params:{page:'2'},start:100},
 {name:'administration notification module',path:directory+'administration/modules/[slug]/page.tsx',table:'crew_notifications',params:{notificationPage:'2'},start:50,slug:'notifications'},
]){
 test(scenario.name+' requests and renders page two',async()=>{
  const {db,calls}=database(scenario.table)
  const page=loadPage(scenario.path,db)
  const tree=await page({searchParams:Promise.resolve(scenario.params),params:Promise.resolve({slug:scenario.slug})})
  const range=calls.find(call=>call.table===scenario.table&&call.method==='range')
  assert.ok(range,'Missing database pagination')
  assert.equal(range.args[0],scenario.start)
  const nodes=elements(tree)
  const hrefs=nodes.map(node=>node.props?.href).filter(value=>typeof value==='string')
  assert.ok(hrefs.some(href=>href.includes('page=1')||href.includes('notificationPage=1')),'Missing working previous page link')
  if(scenario.params.q){
   assert.ok(calls.some(call=>call.method==='ilike'&&call.args[1]===String.raw`%100\%\_crew%`),'Search wildcards must remain literal')
   assert.ok(hrefs.some(href=>href.includes('q=100%25_crew')),'Pagination lost the search filter')
  }
 })
}
