// Diagnose the actual OpenNext bundle before attempting another runtime patch.
// This script deliberately fails closed if the expected manifest loader cannot
// be identified, preventing another known-broken production deployment.
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../.open-next/worker.js', import.meta.url), 'utf8')
for (const token of ['Unexpected loadManifest', 'preview-props.json', 'getPreviewProps', 'loadManifest']) {
  let from = 0
  let hits = 0
  while (hits < 4) {
    const at = source.indexOf(token, from)
    if (at < 0) break
    const excerpt = source.slice(Math.max(0, at - 350), Math.min(source.length, at + 450))
    console.log('OPENNEXT_MANIFEST_DIAGNOSTIC', token, at, JSON.stringify(excerpt))
    from = at + token.length
    hits++
  }
  if (!hits) console.log('OPENNEXT_MANIFEST_DIAGNOSTIC', token, 'NOT FOUND')
}
throw new Error('Manifest loader compatibility not yet verified; block production deployment')
