import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import * as ts from 'typescript'

const roots=['app','components']
const visibleAttributes=new Set(['placeholder','aria-label','aria-description','title','alt'])
const runtimeSetters=new Set(['setStatus','setError','setMessage'])
const untranslatedAllowed=new Set([
  'UP TILL DAWN',
  'UP TILL DAWN Crew',
  'God Mode',
  'Facebook',
  'Excel',
  'GPS',
  'QR',
  'AI',
  'PWA',
  'Supabase',
  'Cloudflare',
  'GitHub',
])

function decode(value){
  return value
    .replaceAll('&apos;',"'")
    .replaceAll('&quot;','"')
    .replaceAll('&amp;','&')
    .replaceAll('&nbsp;',' ')
    .replace(/\s+/g,' ')
    .trim()
}

function meaningful(value){
  if(!value||untranslatedAllowed.has(value))return false
  if(!/[A-Za-zÀ-ÿ]/.test(value))return false
  if(/^https?:\/\//.test(value)||/^\/[A-Za-z0-9_/?#&=.-]+$/.test(value))return false
  if(/^[A-Z0-9_-]{1,4}$/.test(value))return false
  return true
}

async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true})
  const out=[]
  for(const entry of entries){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())out.push(...await walk(full))
    else if(/\.(tsx|ts)$/.test(entry.name))out.push(full)
  }
  return out
}

function literalValues(node){
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return [decode(node.text)]
  if(ts.isConditionalExpression(node))return [...literalValues(node.whenTrue),...literalValues(node.whenFalse)]
  return []
}

function lineOf(source,node){
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line+1
}

test('every static user-facing UI string has NL/FR/EN/DE coverage', async () => {
  const [extension,complete,appCatalog,appExtraCatalog,crewCatalog,crewExtraCatalog]=await Promise.all([
    readFile('lib/ui-translation-extensions.ts','utf8'),
    readFile('lib/ui-translation-complete.ts','utf8'),
    readFile('lib/ui-translation-catalog-app.ts','utf8'),
    readFile('lib/ui-translation-catalog-app-extra.ts','utf8'),
    readFile('lib/ui-translation-catalog-crew.ts','utf8'),
    readFile('lib/ui-translation-catalog-crew-extra.ts','utf8'),
  ])
  const fourLanguageKeys=new Set()
  for(const source of [extension,complete,appCatalog,appExtraCatalog,crewCatalog,crewExtraCatalog]){
    for(const match of source.matchAll(/^\s{2}(['"])(.*?)\1\s*:\s*\{([^\n]+)\},?$/gm)){
      const row=match[3]
      if(/fr:\s*['"][^\n]+?['"]\s*,/.test(row)&&/en:\s*['"][^\n]+?['"]\s*,/.test(row)&&/de:\s*['"][^\n]+?['"]/.test(row)){
        fourLanguageKeys.add(decode(match[2]))
      }
    }
  }

  const files=(await Promise.all(roots.map(walk))).flat()
  const missing=new Map()

  function add(value,file,source,node){
    const text=decode(value)
    if(!meaningful(text)||fourLanguageKeys.has(text))return
    const key=`${text}\u0000${file}`
    if(!missing.has(key))missing.set(key,{text,file,line:lineOf(source,node)})
  }

  for(const file of files){
    const code=await readFile(file,'utf8')
    const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)

    function visit(node){
      if(ts.isJsxText(node))add(node.getText(source),file,source,node)

      if(ts.isJsxAttribute(node)){
        const name=node.name.getText(source)
        if(visibleAttributes.has(name)&&node.initializer&&ts.isStringLiteral(node.initializer)){
          add(node.initializer.text,file,source,node.initializer)
        }
      }

      if(ts.isJsxExpression(node)&&node.expression&&ts.isJsxElement(node.parent)){
        for(const value of literalValues(node.expression))add(value,file,source,node.expression)
      }

      if(ts.isPropertyAssignment(node)){
        const name=node.name.getText(source).replace(/^['"]|['"]$/g,'')
        if(['label','title','description','placeholder','emptyText'].includes(name)){
          for(const value of literalValues(node.initializer))add(value,file,source,node.initializer)
        }
      }

      if(ts.isCallExpression(node)){
        const callee=node.expression
        const simpleName=ts.isIdentifier(callee)?callee.text:null
        const propertyName=ts.isPropertyAccessExpression(callee)?callee.name.text:null
        const shouldCollect=(simpleName&&runtimeSetters.has(simpleName))||propertyName==='prompt'||propertyName==='alert'
        if(shouldCollect&&node.arguments[0]){
          for(const value of literalValues(node.arguments[0]))add(value,file,source,node.arguments[0])
        }
      }

      ts.forEachChild(node,visit)
    }
    visit(source)
  }

  const rows=[...missing.values()].sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line)
  assert.equal(rows.length,0,'Missing four-language UI translations:\n'+rows.map(row=>`- ${row.file}:${row.line} :: ${row.text}`).join('\n'))
})
