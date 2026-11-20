import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// OpenNext 1.20.9 inlines Next's loadManifest during build. Next 16.4 asks
// for preview-props.json, but the adapter's manifest glob excludes it.
// Fix the adapter's build-time plugin BEFORE running opennextjs-cloudflare.
const root = 'node_modules/@opennextjs/cloudflare'
if (!existsSync(root)) throw new Error('OpenNext Cloudflare dist not installed')
const needle = 'prefetch-hints'
const replacement = 'prefetch-hints,preview-props'
let patched = 0
let already = 0
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) { walk(path); continue }
    if (!/\.(?:js|mjs|cjs)$/.test(entry.name)) continue
    const source = readFileSync(path, 'utf8')
    if (source.includes(replacement)) { already++; continue }
    if (!source.includes(needle)) continue
    // The adapter's loader plugin contains both the manifest glob and the loader rule.
    if (!source.includes('required-server-files') || !source.includes('loadManifest')) continue
    const next = source.replace(needle, replacement)
    writeFileSync(path, next)
    patched++
    console.log('Patched OpenNext preview props manifest discovery:', path)
  }
}
walk(root)
if (patched + already < 1) {
  throw new Error(`Expected exactly one OpenNext manifest loader plugin, found patched=${patched} already=${already}; refusing deployment`)
}
console.log('OpenNext preview props manifest loader patched before build')
