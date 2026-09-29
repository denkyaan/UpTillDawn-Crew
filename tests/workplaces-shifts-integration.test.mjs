import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('workplaces is the single integrated workplace and shift surface',async()=>{
  const [page,planner,legacyRoute,nav]=await Promise.all([
    readFile(new URL('../app/(app)/workplaces/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/workplace-shift-planner.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/shifts/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/layout/navigation-items.ts',import.meta.url),'utf8'),
  ])

  assert.match(page,/Werkplaatsen & shifts/)
  assert.match(page,/default_shift_start/)
  assert.match(page,/default_shift_end/)
  assert.match(page,/WorkplaceShiftPlanner/)
  assert.match(page,/ShiftChangeCenter/)
  assert.doesNotMatch(page,/events\(name,start_at,end_at\)/)

  assert.match(planner,/assignAvailableCrewShift/)
  assert.match(planner,/updateShift/)
  assert.match(planner,/cancelShift/)
  assert.match(planner,/confirmShift/)
  assert.match(planner,/declineShift/)
  assert.match(planner,/Personeel \+ uren toevoegen/)
  assert.match(planner,/SHIFT BEVESTIGEN/)
  assert.match(planner,/DIENST WEIGEREN/)

  assert.match(legacyRoute,/redirect\('\/workplaces'\)/)
  assert.match(nav,/label:"Werkplaatsen & shifts"/)
})
