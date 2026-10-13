import test from 'node:test'
import assert from 'node:assert/strict'
import {requiredExerciseIds,trainingReport,resumeExercise,resetTrainingModule,markExerciseVerified} from '../lib/training/completion-policy.ts'
import {ROLE_EXERCISES} from '../lib/training/role-exercise-plan.ts'
const blank=role=>({participantId:'test-participant',role,results:{},questions:[],updatedAt:''})
test('every role has mandatory exercises and cannot finish by navigating',()=>{
 for(const role of ['admin','responsible_lead','employee']){
  const record=blank(role),report=trainingReport(record)
  assert.ok(report.total>20)
  assert.equal(report.completed,0)
  assert.equal(report.canFinish,false)
  assert.equal(resumeExercise(record),requiredExerciseIds(role)[0])
 }
})
test('only verified exercises count; failed attempts are reported',()=>{
 let record=blank('employee')
 const id=requiredExerciseIds('employee')[0]
 record=markExerciseVerified(record,id,false,'Invalid demo input')
 assert.equal(trainingReport(record).completed,0)
 assert.deepEqual(trainingReport(record).failed,[id])
 record=markExerciseVerified(record,id,true)
 assert.equal(trainingReport(record).completed,1)
 assert.equal(record.results[id].attempts,2)
})
test('admin retraining reset preserves unrelated modules and rejects forbidden ones',()=>{
 let record=blank('admin')
 const ids=requiredExerciseIds('admin')
 record=markExerciseVerified(record,ids[0],true)
 record=markExerciseVerified(record,ids.find(id=>id.startsWith('chat:')),true)
 record=resetTrainingModule(record,'events')
 assert.equal(trainingReport(record).completed,1)
 assert.throws(()=>resetTrainingModule(blank('employee'),'platform'),/not permitted/)
 assert.throws(()=>markExerciseVerified(blank('employee'),'platform:review-platform-health',true),/not permitted/)
})
test('fully verified role plan allows completion and unanswered questions do not block it',()=>{
 let record=blank('responsible_lead')
 for(const id of requiredExerciseIds('responsible_lead'))record=markExerciseVerified(record,id,true)
 record.questions.push({id:'q',participantId:record.participantId,role:record.role,message:'Help?',status:'open'})
 const report=trainingReport(record)
 assert.equal(report.canFinish,true)
 assert.equal(report.questions,1)
 assert.equal(report.pending.length,0)
 assert.equal(Object.keys(ROLE_EXERCISES[record.role]).length>0,true)
})
