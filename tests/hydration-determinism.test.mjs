import test from 'node:test'
import assert from 'node:assert/strict'
import {readdir,readFile} from 'node:fs/promises'
import {join,relative} from 'node:path'
import ts from 'typescript'

const ROOT=new URL('../',import.meta.url).pathname
const roots=['app','components','lib']
const unsafe=/\b(?:window|document|navigator|localStorage|sessionStorage|activeUiLocale|initialUiLocale|deviceUiLocale|Date\.now|Math\.random)\b|new\s+Date\s*\(/

async function walk(dir){
  const out=[]
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name.startsWith('.'))continue
    const path=join(dir,entry.name)
    if(entry.isDirectory())out.push(...await walk(path))
    else if(/\.(?:ts|tsx)$/.test(entry.name))out.push(path)
  }
  return out
}

test('client useState initializers are hydration deterministic',async()=>{
  const files=(await Promise.all(roots.map(root=>walk(join(ROOT,root))))).flat()
  const failures=[]
  for(const file of files){
    const source=await readFile(file,'utf8')
    if(!/^["']use client["']/m.test(source))continue
    const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    const visit=node=>{
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='useState'&&node.arguments[0]){
        const init=node.arguments[0]
        const text=init.getText(sf)
        if(unsafe.test(text)){
          const pos=sf.getLineAndCharacterOfPosition(init.getStart(sf))
          failures.push(`${relative(ROOT,file)}:${pos.line+1}: ${text.replace(/\s+/g,' ').slice(0,220)}`)
        }
      }
      ts.forEachChild(node,visit)
    }
    visit(sf)
  }
  assert.deepEqual(failures,[],`Browser-dependent useState initializer(s) can make SSR and hydration disagree:\n${failures.join('\n')}`)
})
