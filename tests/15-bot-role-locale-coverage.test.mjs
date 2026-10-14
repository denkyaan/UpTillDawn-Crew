import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {botMatrix} from '../scripts/bot-role-matrix.mjs'

test('15 isolated actors cover Admin, Responsible and Staff in all four locales',()=>{
  assert.equal(botMatrix.length,15)
  const required=['nl','fr','en','de']
  for(const role of ['admin','responsible','staff']){
    const present=new Set(botMatrix.filter(actor=>actor.role===role).map(actor=>actor.locale))
    for(const locale of required)assert.ok(present.has(locale),role+' missing '+locale)
  }
  assert.deepEqual(botMatrix.slice(0,3),[
    {role:'admin',locale:'nl'},{role:'responsible',locale:'fr'},{role:'staff',locale:'en'},
  ])
  const names=botMatrix.map((actor,i)=>`bot-${String(i+1).padStart(2,'0')}-${actor.role}-${actor.locale}`)
  assert.equal(new Set(names).size,names.length)
})

test('seed fixtures and every browser actor share the matrix and run the complete tour',()=>{
  const seed=readFileSync('scripts/seed-15-bot-users.mjs','utf8')
  const browser=readFileSync('scripts/15-bot-browser-test.mjs','utf8')
  for(const source of [seed,browser]){
    assert.match(source,/import \{botMatrix\} from ['"]\.\/bot-role-matrix\.mjs['"]/)
    assert.match(source,/const roles = botMatrix\.map\(\(\{role\}\)=>role\)/)
    assert.match(source,/botMatrix\[index\]\.locale/)
  }
  assert.match(browser,/if\(index<botMatrix\.length\)/)
  assert.doesNotMatch(browser,/if\(index<4\)/)
  assert.match(browser,/full practical role tour completed/)
  assert.match(browser,/fullyVisited\.length<12/)
  assert.match(browser,/waitForPracticeRecorded/)
})
