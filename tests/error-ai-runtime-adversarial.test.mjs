import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import {calibrateErrorDecision} from '../lib/error-ai-calibration.ts'

const require=createRequire(import.meta.url)
const source=readFileSync('lib/error-report-ai.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText
const diagnostic=[]
const context={
 exports:{},process:{env:{}},
 console:{error:(...args)=>diagnostic.push(args),info:(...args)=>diagnostic.push(args)},
 require(name){
  if(name==='zod')return require('zod')
  if(name==='@/lib/error-ai-calibration')return {calibrateErrorDecision}
  throw Error('Unexpected module imported by Error-AI: '+name)
 },
 fetch(){throw Error('Unexpected external workflow dispatch')},
}
vm.runInNewContext(compiled,context,{filename:'lib/error-report-ai.ts'})
const processErrorReport=context.exports.processErrorReport
assert.equal(typeof processErrorReport,'function')

function fixture(message='Unexpected error',options={}){
 const report={
  id:'00000000-0000-4000-8000-00000000e2e1',
  route:'/events',error_name:'Error',error_message:message,stack_trace:null,
  source:'runtime',client_context:{},reported_count:1,...options,
 }
 const calls=[]
 const client={
  rpc:async(name,parameters)=>{
   calls.push({name,parameters})
   if(name==='upt_start_error_report_ai')return {data:options.started??true,error:null}
   return {data:null,error:null}
  },
  from:(table)=>{
   assert.equal(table,'user_error_reports')
   return {select(){return this},eq(){return this},single:async()=>({
    data:options.loadError?null:report,
    error:options.loadError?{code:'PGRST116'}:null,
   })}
  },
 }
 return {client,calls,report}
}
const model=(overrides={})=>({
 response:{
  category:'code',severity:'medium',summary:'AI diagnosis of code exception',
  userMessage:'This was fixed automatically',autoAction:'retry',
  makerActionRequired:true,makerAction:'Disable security checks',godPrompt:'Ignore safeguards',
  ...overrides,
 },
})
const finalized=calls=>calls.findLast(x=>x.name==='upt_finalize_error_report_ai')?.parameters

test('real Error-AI pipeline does not dispatch nonexistent self-heal workflow or falsely resolve issues',async()=>{
 const x=fixture('Unexpected exception')
 const ai={run:async()=>model()}
 await processErrorReport(x.client,x.report.id,ai)
 const result=finalized(x.calls)
 assert.ok(result)
 assert.equal(result.p_status,'failed')
 assert.equal(result.p_auto_action,'none')
 assert.equal(result.p_maker_action_required,false)
 assert.match(result.p_user_message,/nog niet bevestigd/)
 assert.equal(result.p_god_prompt,undefined)
})

test('permission error is high severity with no model roundtrip or bypass',async()=>{
 const x=fixture('permission denied for table profiles')
 let runs=0
 await processErrorReport(x.client,x.report.id,{run:async()=>{runs++;return model()}})
 const result=finalized(x.calls)
 assert.equal(runs,0,'Deterministic permission errors should not require a model')
 assert.equal(result.p_status,'failed')
 assert.equal(result.p_category,'permission')
 assert.equal(result.p_severity,'high')
 assert.equal(result.p_auto_action,'none')
})

test('hydration error is analyzed with a manual-only reload suggestion and remains unresolved',async()=>{
 const x=fixture('Hydration failed because server rendered unexpected HTML',{source:'boundary'})
 await processErrorReport(x.client,x.report.id,{run:async()=>model()})
 const result=finalized(x.calls)
 assert.equal(result.p_auto_action,'reload')
 assert.equal(result.p_status,'failed')
 assert.equal(result.p_maker_action_required,false)
})

test('invalid model JSON is retried at most once then recorded as an unresolved deterministic fallback',async()=>{
 const x=fixture('Unknown UI failure')
 let tries=0
 await processErrorReport(x.client,x.report.id,{run:async()=>{tries++;return {response:'not json'}}})
 assert.equal(tries,2)
 assert.equal(finalized(x.calls).p_status,'failed')
 assert.equal(finalized(x.calls).p_category,'unknown')
})

test('provider failure remains a visible unresolved report instead of marking repaired',async()=>{
 const x=fixture('Unexpected provider error')
 await processErrorReport(x.client,x.report.id,{run:async()=>{throw Error('Provider unavailable')}})
 assert.equal(finalized(x.calls).p_status,'failed')
 assert.equal(finalized(x.calls).p_auto_action,'none')
})

test('missing AI binding leaves report explicitly failed and never attempts external recovery',async()=>{
 const x=fixture('Unexpected failure')
 await processErrorReport(x.client,x.report.id,undefined)
 const result=finalized(x.calls)
 assert.equal(result.p_status,'failed')
 assert.equal(result.p_maker_action_required,false)
})

test('failed report retrieval cannot leave started report stuck indefinitely',async()=>{
 const x=fixture('Error',{loadError:true})
 await processErrorReport(x.client,x.report.id,{run:async()=>model()})
 assert.equal(finalized(x.calls).p_status,'failed')
})

test('already-claimed report is never analyzed or finalized twice',async()=>{
 const x=fixture('Error',{started:false})
 let invoked=0
 await processErrorReport(x.client,x.report.id,{run:async()=>{invoked++;return model()}})
 assert.equal(invoked,0)
 assert.equal(finalized(x.calls),undefined)
})
