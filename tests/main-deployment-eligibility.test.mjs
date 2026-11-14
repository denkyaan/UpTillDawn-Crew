import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

// Execute the actual Actions shell gate with a local gh stub. No credentials,
// network access or deployment commands are involved in this regression test.
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
const section=workflow.match(/- name: Explain deployment eligibility([\s\S]*?)\n  deploy:/)?.[1]
assert.ok(section,'Deployment eligibility step missing')
const run=section.match(/        run: \|\n([\s\S]*)/)?.[1].split('\n').map(line=>line.replace(/^ {10}/,'')).join('\n')
assert.ok(run,'Deployment eligibility shell missing')
const current='a'.repeat(40),older='b'.repeat(40)
for(const scenario of [
 {name:'successful current push deploys',sha:current,result:'success',eligible:'true',exit:0},
 {name:'successful current push with explicit QA marker deploys and enables isolated QA',sha:current,result:'success',eligible:'true',qa:'true',commitMessage:'test(main): authorized QA [main-qa-e2e]',exit:0},
 {name:'superseded success is skipped',sha:older,result:'success',eligible:'false',exit:0},
 {name:'superseded cancellation is skipped',sha:older,result:'cancelled',eligible:'false',exit:0},
 {name:'superseded failure is skipped',sha:older,result:'failure',eligible:'false',exit:0},
 {name:'current failure still blocks release',sha:current,result:'failure',eligible:'false',exit:1},
 {name:'current cancellation still blocks release',sha:current,result:'cancelled',eligible:'false',exit:1},
 {name:'manual CI cannot trigger main deployment',sha:current,result:'success',event:'workflow_dispatch',eligible:'false',exit:0},
 {name:'another branch cannot trigger main deployment',sha:current,result:'success',branch:'feature/test',eligible:'false',exit:0},
 {name:'missing commit cannot trigger main deployment',sha:'',result:'failure',eligible:'false',exit:0},
])test('main eligibility: '+scenario.name,()=>{
 const dir=mkdtempSync(join(tmpdir(),'upt-main-eligibility-'))
 try{
  writeFileSync(join(dir,'gh'),'#!/bin/bash\nif [[ "$*" == *".commit.message"* ]]; then printf \'%s\n\' "$CURRENT_MAIN_COMMIT_MESSAGE"; else printf \'%s\n\' "$CURRENT_MAIN_SHA"; fi\n',{mode:0o700})
  const output=join(dir,'output')
  const result=spawnSync('/bin/bash',['-euo','pipefail','-c',run],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,REPO:'test/repository',CURRENT_MAIN_SHA:current,CURRENT_MAIN_COMMIT_MESSAGE:scenario.commitMessage??'',SOURCE_SHA:scenario.sha,SOURCE_RESULT:scenario.result,SOURCE_EVENT:scenario.event??'push',SOURCE_BRANCH:scenario.branch??'main',GITHUB_OUTPUT:output}})
  assert.ifError(result.error)
  assert.equal(result.status,scenario.exit,result.stdout+result.stderr)
  const expected='eligible='+scenario.eligible+(scenario.eligible==='true'?'\nqa_eligible='+(scenario.qa??'false'):'')
  assert.equal(readFileSync(output,'utf8').trim(),expected)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
