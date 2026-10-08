import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = '.open-next'
const tokens = ['Unexpected loadManifest', 'preview-props.json', 'getPreviewProps', 'loadManifest']
let matches = 0
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) { walk(path); continue }
    if (!/\\.(?:js|mjs|cjs)$/.test(entry.name)) continue
    const source = readFileSync(path, 'utf8')
    for (const token of tokens) {
      const at = source.indexOf(token)
      if (at < 0) continue
      matches++
      console.log('OPENNEXT_MANIFEST_DIAGNOSTIC', path, token, at,
        JSON.stringify(source.slice(Math.max(0, at - 500), at + 650)))
    }
  }
}
walk(root)
console.log('OPENNEXT_MANIFEST_DIAGNOSTIC total matches:', matches)
throw new Error('Production blocked pending confirmed OpenNext manifest runtime correction')
