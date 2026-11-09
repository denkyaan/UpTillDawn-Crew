import test from 'node:test'
import assert from 'node:assert/strict'
import {access,readFile,readdir} from 'node:fs/promises'
import path from 'node:path'

const retired=[
  {path:'components/portal-guided-tour.tsx',symbol:'PortalGuidedTour',importPath:'portal-guided-tour'},
  {path:'components/crew/workplace-tour-button.tsx',symbol:'WorkplaceTourButton',importPath:'workplace-tour-button'},
]
const runtimeRoots=['app','components','lib','services','workers']

async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true})
  const paths=await Promise.all(entries.map(async entry=>{
    const file=path.join(dir,entry.name)
    return entry.isDirectory()?walk(file):/\.(?:tsx?|mjs|js)$/.test(entry.name)?[file]:[]
  }))
  return paths.flat()
}

test('retired guided tours are absent from all runtime modules',async()=>{
  for(const entry of retired){
    await assert.rejects(access(entry.path),{code:'ENOENT'},entry.path)
  }
  const files=(await Promise.all(runtimeRoots.map(walk))).flat()
  for(const file of files){
    const source=await readFile(file,'utf8')
    for(const entry of retired){
      assert.ok(!source.includes(entry.symbol)&&!source.includes(entry.importPath),
        `Retired tour reference remains in ${file}: ${entry.symbol}`)
    }
  }
})

test('real operational event preparation stays available',async()=>{
  const [onboarding,briefings,workplaces]=await Promise.all([
    readFile('app/(app)/onboarding/page.tsx','utf8'),
    readFile('app/(app)/briefings/page.tsx','utf8'),
    readFile('app/(app)/workplaces/page.tsx','utf8'),
  ])
  assert.match(onboarding,/completeEventOnboardingStep/)
  assert.match(briefings,/acknowledgeBriefing/)
  assert.match(workplaces,/ContextLink/)
})
