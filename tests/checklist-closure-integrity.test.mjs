import test from 'node:test'
import assert from 'node:assert/strict'
import {checklistItemIsComplete,checklistCanClose,checklistCompletionRate} from '../lib/checklists.ts'
const item={id:'i1',label:'Safety checked',required:true,completedAt:0}
const checklist={id:'c1',kind:'safety',items:[item]}
test('checklist timestamp zero is a recorded completion and photo evidence remains required',()=>{
 assert.equal(checklistItemIsComplete(item),true)
 assert.equal(checklistCanClose(checklist),true)
 assert.equal(checklistItemIsComplete({...item,requiresPhoto:true}),false)
 assert.equal(checklistItemIsComplete({...item,requiresPhoto:true,photoAttached:true}),true)
 for(const completedAt of [NaN,Infinity,-1,null])assert.equal(checklistItemIsComplete({...item,completedAt}),false)
})
test('checklist closure rejects missing identity, duplicate items and empty checklists',()=>{
 assert.equal(checklistCanClose({...checklist,items:[]}),false)
 assert.equal(checklistCanClose({...checklist,id:' '}),false)
 assert.equal(checklistCanClose({...checklist,items:[item,{...item}]}),false)
 assert.equal(checklistCanClose({...checklist,items:[{...item,id:' '}]}),false)
 assert.equal(checklistCanClose({...checklist,items:[{...item,completedAt:null}]}),false)
 assert.equal(checklistCompletionRate(checklist),1)
 assert.equal(checklistCompletionRate({...checklist,items:[]}),0)
})
