// Next.js 16.4 calls getPreviewProps during server construction.
// OpenNext 1.20.9's manifest loader throws on preview-props.json.
// Narrow runtime workaround: only that manifest gets an empty object.
// Fail the deployment build if the generated loader changes unexpectedly.
import { readFileSync, writeFileSync } from 'node:fs'
const file = new URL('../.open-next/worker.js', import.meta.url)
let source = readFileSync(file, 'utf8')
const needle = 'Unexpected loadManifest('
if (!source.includes(needle)) {
  throw new Error('OpenNext manifest loader signature changed; refusing unsafe patch')
}
const patterns = [
  /throw new Error\(`Unexpected loadManifest\(\$\{([\w$]+)\}\) call!\`\);?/,
  /throw new Error\("Unexpected loadManifest\(" \+ ([\w$]+) \+ "\) call!"\);?/,
  /throw Error\(`Unexpected loadManifest\(\$\{([\w$]+)\}\) call!\`\);?/
]
let patched = false
for (const pattern of patterns) {
  const match = source.match(pattern)
  if (!match) continue
  const variable = match[1]
  const replacement = `if (String(${variable}).endsWith("/.next/server/preview-props.json")) return {}; ${match[0]}`
  source = source.replace(match[0], replacement)
  patched = true
  break
}
if (!patched) {
  throw new Error('Could not safely locate OpenNext manifest throw statement; refusing deploy')
}
writeFileSync(file, source)
console.log('Patched OpenNext preview-props manifest fallback (Next.js 16.4)')
