import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

for(const [route,lazyName,role] of [
 ['events','LazyStaffEvents','user'],
 ['tasks','LazyStaffTasks','user'],
]){
 test('free-worker Staff '+route+' SSR excludes manager-only module graph',()=>{
  const entry=readFileSync('app/(app)/'+route+'/page.tsx','utf8')
  const manager=readFileSync('app/(app)/'+route+'/manager-page.tsx','utf8')
  assert.match(entry,/await getCurrentUser\(\)/,'Staff must remain server-verified')
  assert.match(entry,new RegExp("if\\("+role+"\\.role==='staff'\\)"),'Staff role guard must remain')
  assert.match(entry,new RegExp(lazyName))
  assert.match(entry,/await import\('\.\/manager-page'\)/,'Defer all management SSR imports until the verified manager path')
  assert.doesNotMatch(entry,/from ['"]@\/lib\/actions\/uptilldawn|from ['"]@\/components\/crew\/inventory-panel|from ['"]@\/components\/events\/archive-center/,'Staff must not import privileged management tree')
  assert.match(manager,/await getCurrentUser\(\)/,'Keep authorization inside the management module')
  assert.doesNotMatch(manager,/LazyStaff(Events|Tasks)/,'No staff view bundled in management module')
  assert.match(manager,/return <main|return\s*\(/,'Original management UI must be preserved')
 })
}
