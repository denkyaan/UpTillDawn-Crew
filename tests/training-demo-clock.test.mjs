import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {settleTrainingClock} from '../lib/training-demo-clock.ts'

test('isolated event, break and driving timers never double count',()=>{
  let state={operationPhase:'working',clockUpdatedAt:1000,workSeconds:0,driveSeconds:0,breakSeconds:0}
  state=settleTrainingClock(state,61000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[60,0,0])
  state=settleTrainingClock({...state,operationPhase:'break'},121000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[60,0,60])
  state=settleTrainingClock({...state,operationPhase:'resumed'},181000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[120,0,60])
  state=settleTrainingClock({...state,operationPhase:'driving'},241000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[120,60,60])
  state=settleTrainingClock({...state,operationPhase:'at_person'},301000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[120,60,60])
  state=settleTrainingClock({...state,operationPhase:'returning'},361000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[120,120,60])
  state=settleTrainingClock({...state,operationPhase:'finished'},421000)
  assert.deepEqual([state.workSeconds,state.driveSeconds,state.breakSeconds],[120,120,60])
  assert.deepEqual([settleTrainingClock(state,0).workSeconds,settleTrainingClock(state,0).driveSeconds],[120,120])
})

test('the tour persists phase snapshots and displays the independent break clock',()=>{
  const src=readFileSync('components/training/sandbox-operations.tsx','utf8')
  assert.match(src,/settleTrainingClock\(readTrainingState\(\),Date\.now\(\)\)/)
  assert.match(src,/phase==="break"\?breakTime:time/)
  assert.match(src,/setInterval\(tick,1000\)/)
  assert.doesNotMatch(src,/\["working","driving","at_person","returning","break"\]/)
  assert.match(src,/workSeconds:0,driveSeconds:0,breakSeconds:0/)
})
