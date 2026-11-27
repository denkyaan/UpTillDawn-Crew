import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const source=readFileSync(new URL('../.github/workflows/fast-change-validation.yml',import.meta.url),'utf8')
const job=source.split('  phase-two-three-local-acceptance:')[1]?.split('  release-production:')[0]||''
const blocks=[...job.matchAll(/^        run: \|\s*\n((?:^ {10}[^\n]*\n|^\n)+)/gm)]

test('every isolated phase 2/3 multiline shell step parses before database startup', {skip:process.platform==='win32'},()=>{
 assert.ok(blocks.length>=10,'acceptance scripts missing')
 for(const [full,body] of blocks){
  const script=body.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n')
  const result=spawnSync('bash',['-n'],{input:script,encoding:'utf8'})
  assert.ifError(result.error)
  assert.equal(result.status,0,'Shell step near '+job.slice(0,job.indexOf(full)).split('\n').filter(line=>line.startsWith('      - name:')).at(-1)+'\n'+result.stderr)
 }
})

test('seed-dependent SQL suite dispatch and transactional assertion delimiters remain intact',()=>{
 const caseLine=job.split('\n').find(line=>line.includes('tests/sql/owner-leadership-privacy.sql|'))
 assert.ok(caseLine?.trim().endsWith(') continue ;;'),'case pattern must close')
 assert.match(job,/DO \$qa\$ BEGIN/)
 assert.match(job,/END \$qa\$;/)
 assert.doesNotMatch(job,/DO \$ BEGIN|END \$;/)
})
