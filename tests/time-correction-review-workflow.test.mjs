import test from 'node:test'
import assert from 'node:assert/strict'
import {timeCorrectionIsValid,timeCorrectionCanReview,reviewTimeCorrection,cancelTimeCorrection} from '../lib/time-correction.ts'
const request={id:'c1',userId:'worker',shiftId:'shift',requestedStartAt:1000,requestedEndAt:2000,reason:'Forgot check-in',status:'pending',createdAt:500}
test('correction approval records reviewer and preserves original request',()=>{
 const approved=reviewTimeCorrection(request,'approved','manager',600)
 assert.equal(approved.status,'approved')
 assert.equal(approved.reviewedBy,'manager')
 assert.equal(approved.reviewedAt,600)
 assert.equal(request.status,'pending')
 assert.equal(timeCorrectionIsValid(approved),true)
 assert.equal(timeCorrectionCanReview(approved),false)
 assert.throws(()=>reviewTimeCorrection(approved,'rejected','manager',700),/not reviewable/)
})
test('reviewer must be distinct and timestamp must be ordered',()=>{
 assert.throws(()=>reviewTimeCorrection(request,'approved','worker',600),/Invalid time correction reviewer/)
 assert.throws(()=>reviewTimeCorrection(request,'approved','',600),/Invalid time correction reviewer/)
 assert.throws(()=>reviewTimeCorrection(request,'approved','manager',499),/Invalid time correction review timestamp/)
 assert.equal(timeCorrectionIsValid({...request,createdAt:0.5}),false)
 assert.equal(timeCorrectionIsValid({...request,status:'approved'}),false)
 assert.equal(timeCorrectionIsValid({...request,status:'pending',reviewedBy:'manager',reviewedAt:600}),false)
})
test('only request owner can cancel an unreviewed correction',()=>{
 const cancelled=cancelTimeCorrection(request,'worker')
 assert.equal(cancelled.status,'cancelled')
 assert.equal(timeCorrectionIsValid(cancelled),true)
 assert.throws(()=>cancelTimeCorrection(request,'manager'),/cannot be cancelled/)
 assert.throws(()=>cancelTimeCorrection(cancelled,'worker'),/cannot be cancelled/)
})
