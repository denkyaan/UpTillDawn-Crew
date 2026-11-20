import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

function clean(value){
  return value.replace(/\s+/g,' ').trim()
}

function catalogKeys(source){
  return new Set([...source.matchAll(/^\s{2}(['"])(.*?)\1\s*:\s*\{[^\n]*\bfr\s*:[^\n]*\ben\s*:[^\n]*\bde\s*:/gm)].map(match=>clean(match[2])))
}

test('all field-help labels and descriptions have NL/FR/EN/DE runtime coverage',async()=>{
  const [help,extension,complete,app,appExtra,crew,crewExtra,god]=await Promise.all([
    readFile(new URL('../lib/ui-field-help.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-extensions.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-complete.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-app.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-app-extra.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew-extra.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-god.ts',import.meta.url),'utf8'),
  ])
  const covered=new Set([
    ...catalogKeys(extension),...catalogKeys(complete),...catalogKeys(app),...catalogKeys(appExtra),
    ...catalogKeys(crew),...catalogKeys(crewExtra),...catalogKeys(god),
  ])
  const sf=ts.createSourceFile('ui-field-help.ts',help,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  const visible=[]
  function visit(node){
    if(ts.isPropertyAssignment(node)){
      const name=node.name.getText(sf).replace(/^['"]|['"]$/g,'')
      if((name==='label'||name==='description')&&(ts.isStringLiteral(node.initializer)||ts.isNoSubstitutionTemplateLiteral(node.initializer))){
        visible.push(clean(node.initializer.text))
      }
    }
    ts.forEachChild(node,visit)
  }
  visit(sf)
  const missing=[...new Set(visible.filter(value=>/[A-Za-zÀ-ÿ]/.test(value)&&!covered.has(value)))].sort()
  assert.equal(missing.length,0,'Missing four-language field-help translations:\n'+missing.map(value=>'- '+value).join('\n'))
})
