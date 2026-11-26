import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('deferred translation preserves the most recent explicit language and exact raster comparison',()=>{
 const sync=readFileSync('components/locale-sync.tsx','utf8')
 assert.ok(sync.includes('localeSource = source'))
 assert.ok(sync.includes('applyLocale(locale,localeSource)'))
 const qa=readFileSync('modern/tests/login-parity-qa.mjs','utf8')
 for(const flag of ['--disable-partial-raster','--disable-gpu-rasterization','--run-all-compositor-stages-before-draw'])assert.ok(qa.includes(flag))
 assert.ok(qa.includes('legacy.pixels.equals(modern.pixels)'))
 assert.ok(qa.includes('pixelTolerance:0'))
 assert.ok(qa.includes('comparisons!==48||interactionComparisons!==160||failures.length'))
})
