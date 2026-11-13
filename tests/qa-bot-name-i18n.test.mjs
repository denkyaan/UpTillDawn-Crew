import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {translateAppUi,translateQaBotName} from '../lib/ui-translation-catalog-app.ts'

const names=[
  [
    "E2E Hoofdadmin",
    "E2E Admin principal",
    "E2E Head Admin",
    "E2E Hauptadmin"
  ],
  [
    "E2E Linkerhand",
    "E2E Bras gauche",
    "E2E Left hand",
    "E2E Linke Hand"
  ],
  [
    "E2E Rechterhand",
    "E2E Bras droit",
    "E2E Right hand",
    "E2E Rechte Hand"
  ],
  [
    "E2E Administratie",
    "E2E Administration",
    "E2E Administration",
    "E2E Verwaltung"
  ],
  [
    "E2E Promotie",
    "E2E Promotion",
    "E2E Promotion",
    "E2E Promotion"
  ],
  [
    "E2E Verantwoordelijke",
    "E2E Responsable",
    "E2E Responsible",
    "E2E Verantwortliche"
  ],
  [
    "E2E Personeel",
    "E2E Personnel",
    "E2E Staff",
    "E2E Personal"
  ]
]
test('the seven persistent E2E bot names are catalogued in NL/FR/EN/DE',()=>{
 for(const [nl,fr,en,de] of names){
  for(const [locale,expected] of [['nl',nl],['fr',fr],['en',en],['de',de]]){
   assert.equal(translateQaBotName(nl,locale),expected,nl+' '+locale)
   assert.equal(translateAppUi(expected,locale),expected,'catalog reverse-mapping '+nl+' '+locale)
  }
 }
 assert.equal(new Set(names.map(row=>row[0])).size,7)
})
test('QA name localization is only for synthetic labels and preserves ordinary names',()=>{
 for(const locale of ['nl','fr','en','de']){
  for(const name of ['Jane Doe','E2E External Person','Een echte naam','Administratie Hoofdadmin','E2E-Staff']){
   assert.equal(translateQaBotName(name,locale),name)
  }
 }
 assert.equal(translateQaBotName(null,'fr'),'')
})
test('both personnel portals render catalogued QA names using requested locale',()=>{
 const admin=readFileSync('app/(app)/personnel/page.tsx','utf8')
 const staff=readFileSync('app/(app)/portals/administration/personnel/page.tsx','utf8')
 const runtime=readFileSync('lib/ui-translation-runtime.ts','utf8')
 const sync=readFileSync('components/locale-sync.tsx','utf8')
 for(const file of [admin,staff])assert.match(file,/translateQaBotName\(.*\.full_name,locale\)/)
 assert.match(staff,/localeCompare\(translateQaBotName/)
 assert.match(runtime,/translateAppUi/)
 assert.match(sync,/translateRuntimeUi/)
})
