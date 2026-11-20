import test from 'node:test'
import assert from 'node:assert/strict'
import {canTransitionTask,taskIsOverdue} from '../lib/task-workflow.ts'
import {checklistCanClose,checklistCompletionRate} from '../lib/checklists.ts'
test('task transitions fail closed for unknown statuses instead of crashing',()=>{
 assert.equal(canTransitionTask('unknown','open'),false)
 assert.equal(canTransitionTask('open','unknown'),false)
 assert.equal(canTransitionTask('open','completed'),true)
})
test('overdue tasks reject malformed deadlines and clock values',()=>{
 assert.equal(taskIsOverdue('open',NaN,100),false)
 assert.equal(taskIsOverdue('open',-1,100),false)
 assert.equal(taskIsOverdue('open',10,NaN),false)
 assert.equal(taskIsOverdue('open',10,100),true)
 assert.equal(taskIsOverdue('completed',10,100),false)
})
test('checklist closure requires recognized kind and unique valid item IDs',()=>{
 const c={id:'c',kind:'closing',items:[{id:'one',label:'Secure doors',required:true,completedAt:100}]}
 assert.equal(checklistCanClose(c),true)
 assert.equal(checklistCanClose({...c,kind:'unknown'}),false)
 assert.equal(checklistCanClose({...c,items:[...c.items,{...c.items[0]}]}),false)
 assert.equal(checklistCompletionRate({...c,items:[...c.items,{...c.items[0]}]}),0)
})
