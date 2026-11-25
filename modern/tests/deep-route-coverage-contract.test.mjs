import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pages,routePath,ts} from '../tooling/main-source.mjs'

const repo=resolve(import.meta.dirname,'../..')
const file=readFileSync(resolve(repo,'modern/tests/deep-route-parity-qa.mjs'),'utf8')
const ast=ts.createSourceFile('deep-route-parity-qa.mjs',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
const declaration=ast.statements.flatMap(s=>ts.isVariableStatement(s)?[...s.declarationList.declarations]:[]).find(x=>x.name.getText(ast)==='cases')
if(!declaration||!ts.isArrayLiteralExpression(declaration.initializer))throw Error('Deep live QA role/route cases missing')
function property(item,key){
 const entry=item.properties.find(x=>ts.isPropertyAssignment(x)&&x.name.getText(ast)===key)
 if(!entry||!ts.isPropertyAssignment(entry))throw Error('Deep QA case is missing '+key)
 return entry.initializer
}
const cases=declaration.initializer.elements.map(x=>{
 if(!ts.isObjectLiteralExpression(x))throw Error('Nonliteral QA role')
 const role=property(x,'role'),portal=property(x,'portal'),paths=property(x,'paths')
 if(!ts.isStringLiteral(role)||!ts.isStringLiteral(portal)||!ts.isArrayLiteralExpression(paths))throw Error('Nonliteral QA identity or routes')
 return {role:role.text,portal:portal.text,paths:paths.elements.map(p=>{
  if(!ts.isStringLiteral(p))throw Error('Computed QA route not allowed')
  return p.text
 })}
})

test('44 separate original Main authenticated browser screens across seven live QA roles',()=>{
 assert.equal(cases.length,7)
 assert.deepEqual(cases.map(c=>c.role),['head_admin','left_hand','right_hand','administration','responsible','staff','promotion'])
 assert.equal(cases.reduce((sum,c)=>sum+c.paths.length,0),44)
 const valid=new Set(pages.map(routePath))
 for(const c of cases){
  assert.ok(c.paths.length>=4,'Each role requires multiple meaningful deep views: '+c.role)
  assert.equal(new Set(c.paths).size,c.paths.length,'Duplicate deep QA route: '+c.role)
  for(const path of c.paths)assert.ok(valid.has(path),'Original source lacks page '+path)
 }
})
test('live QA still fails closed on any mismatch, timeout, or unfinished route and never performs writes',()=>{
 assert.ok(file.includes('DEEP_PARITY_ROUTE_FAILED'))
 assert.ok(file.includes('DEEP_PARITY_ALL_MISMATCHES'))
 assert.ok(file.includes('DEEP_PARITY_MISMATCHES'))
 assert.ok(file.includes('formsSubmitted')===false||file.includes('writeActionsSubmitted:0'))
 assert.ok(file.includes('mainCutoverAllowed:false'))
 assert.ok(file.includes('fullFunctionalParityVerified:false'))
 assert.ok(file.includes("const layout=list('header,nav,main,main h1,main h2'"))
 const workflow=readFileSync(resolve(repo,'.github/workflows/deploy-main.yml'),'utf8')
 assert.ok(workflow.includes('Compare 44 deep original pages across seven real QA roles'))
 // The old fixed success sentence could not distinguish failed/skipped
 // deep comparisons from actual runtime acceptance.
 assert.ok(workflow.includes('id: qa_deep'))
 assert.ok(workflow.includes('QA_DEEP_OUTCOME: ${{ steps.qa_deep.outcome }}'))
 assert.ok(workflow.includes('node modern/scripts/qa-live-verdict.mjs'))
 assert.ok(file.includes('if(signins!==7||validated!==EXPECTED)'))
 const verdict=readFileSync(resolve(repo,'modern/scripts/qa-live-verdict.mjs'),'utf8')
 assert.ok(verdict.includes("['deep-routes','QA_DEEP_OUTCOME']"))
 assert.ok(verdict.includes("results.every(stage=>stage.outcome==='success')"))
 assert.ok(verdict.includes('if(!result.allReadOnlyStagesPassed)process.exitCode=1'))
 assert.ok(workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
})
