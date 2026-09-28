import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT=new URL('..',import.meta.url)
const ATTRIBUTES=new Set(['placeholder','aria-label','aria-description','title','alt'])
const USER_MESSAGE_CALLS=new Set(['setStatus','setError','setMessage'])
const INVARIANT=new Set([
  'UP TILL DAWN',
  'UP TILL DAWN Crew',
  'God Mode',
  'Facebook',
  'Excel',
  'QR',
  'GPS',
])

async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true})
  const out=[]
  for(const entry of entries){
    const path=join(dir,entry.name)
    if(entry.isDirectory())out.push(...await walk(path))
    else if(entry.isFile()&&path.endsWith('.tsx'))out.push(path)
  }
  return out
}

function clean(value){
  return value.replace(/\s+/g,' ').replace(/&apos;/g,"'").replace(/&quot;/g,'"').trim()
}

function isTranslatable(value){
  if(!value||INVARIANT.has(value))return false
  if(!/[A-Za-zÀ-ÿ]/.test(value))return false
  if(/^https?:\/\//.test(value)||/^\//.test(value))return false
  if(/^[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(value))return false
  if(/^[A-Z0-9_-]{1,4}$/.test(value))return false
  return true
}

function expressionStrings(node){
  if(!node)return []
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return [clean(node.text)]
  if(ts.isParenthesizedExpression(node))return expressionStrings(node.expression)
  if(ts.isConditionalExpression(node))return [...expressionStrings(node.whenTrue),...expressionStrings(node.whenFalse)]
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return expressionStrings(node.right)
  if(ts.isTemplateExpression(node)){
    const parts=[clean(node.head.text),...node.templateSpans.map(span=>clean(span.literal.text))]
    return parts.filter(Boolean)
  }
  return []
}

function callName(node){
  if(ts.isIdentifier(node.expression))return node.expression.text
  if(ts.isPropertyAccessExpression(node.expression)){
    const left=node.expression.expression.getText()
    const right=node.expression.name.text
    if(left==='window'&&['prompt','confirm','alert'].includes(right))return right
    if(left==='toast')return 'toast'
  }
  return ''
}

function collectVisibleStrings(sourceText,fileName){
  const sf=ts.createSourceFile(fileName,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const found=[]
  function add(value,node){
    const text=clean(value)
    if(isTranslatable(text))found.push({text,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1})
  }
  function visit(node){
    if(ts.isJsxText(node))add(node.text,node)
    if(ts.isJsxAttribute(node)&&ATTRIBUTES.has(node.name.getText(sf))&&node.initializer){
      if(ts.isStringLiteral(node.initializer))add(node.initializer.text,node)
      else if(ts.isJsxExpression(node.initializer)&&node.initializer.expression){
        for(const value of expressionStrings(node.initializer.expression))add(value,node)
      }
    }
    if(ts.isJsxExpression(node)&&node.parent&&!ts.isJsxAttribute(node.parent)&&node.expression){
      for(const value of expressionStrings(node.expression))add(value,node)
    }
    if(ts.isCallExpression(node)){
      const name=callName(node)
      if(USER_MESSAGE_CALLS.has(name)||['prompt','confirm','alert','toast'].includes(name)){
        for(const arg of node.arguments.slice(0,1)){
          for(const value of expressionStrings(arg))add(value,arg)
        }
      }
    }
    ts.forEachChild(node,visit)
  }
  visit(sf)
  return found
}

function completeKeys(source){
  return new Set([...source.matchAll(/^\s{2}["']([^"']+)["']\s*:\s*\{[^\n]*\bfr\s*:[^\n]*\ben\s*:[^\n]*\bde\s*:/gm)].map(match=>clean(match[1])))
}

test('every static UI string has NL/FR/EN/DE translation coverage',async()=>{
  const [extension,complete,app,extra,crew]=await Promise.all([
    readFile(new URL('../lib/ui-translation-extensions.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-complete.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-app.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-app-extra.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew.ts',import.meta.url),'utf8'),
  ])
  const covered=new Set([
    ...completeKeys(extension),
    ...completeKeys(complete),
    ...completeKeys(app),
    ...completeKeys(extra),
    ...completeKeys(crew),
  ])
  const files=[...await walk(new URL('../app',import.meta.url)),...await walk(new URL('../components',import.meta.url))]
  const missing=[]
  for(const file of files){
    const source=await readFile(file,'utf8')
    for(const item of collectVisibleStrings(source,file)){
      if(!covered.has(item.text))missing.push(`${relative(new URL('..',import.meta.url).pathname,file)}:${item.line} :: ${item.text}`)
    }
  }
  const unique=[...new Set(missing)].sort()
  assert.equal(unique.length,0,`Missing four-language UI translations:\n${unique.join('\n')}`)
})
