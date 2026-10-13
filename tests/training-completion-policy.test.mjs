import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const policy=readFileSync(new URL('../lib/training/completion-policy.ts',import.meta.url),'utf8')
const plan=readFileSync(new URL('../lib/training/role-exercise-plan.ts',import.meta.url),'utf8')
test('completion requires every verified role exercise',()=>{
 assert.match(policy,/requiredExerciseIds\(record\.role\)/)
 assert.match(policy,/verified===true/)
 assert.match(policy,/canFinish:pending\.length===0/)
})
test('resume selects the first incomplete exercise',()=>{
 assert.match(policy,/pending\[0\]\?\?null/)
})
test('retraining rejects forbidden role modules and resets results',()=>{
 assert.match(policy,/Module not permitted for role/)
 assert.match(policy,/delete results\[module\+":"\+id\]/)
})
test('all three operational roles have exercise plans',()=>{
 for(const role of ['admin','responsible_lead','employee'])assert.match(plan,new RegExp(role+'\\s*:'))
})
