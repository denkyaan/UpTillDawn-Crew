import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const ROOT=path.resolve(new URL('..',import.meta.url).pathname)
const TRANSLATABLE_ATTRIBUTES=new Set([
  'placeholder','aria-label','aria-description','title','alt',
  'label','description','helperText','heading','summary',
])
const SKIP_ATTRIBUTE_EXPRESSIONS=new Set([
  'className','href','src','value','name','type','key','id','role','method','action',
  'accept','target','rel','htmlFor','data-testid','data-layout-key','style',
])
const NON_TRANSLATABLE=new Set([
  'UP TILL DAWN','Up Till Dawn','Geoapify','OpenStreetMap contributors','Excel',
  'iPhone / iPad','naam@email.com','100% / 320px','auto / 48px','16px','12px','0px','0.75rem',
  'components/nieuwe-knop.tsx','Promise',
])

function normalize(value){
  return value
    .replace(/&apos;/g,"'")
    .replace(/&quot;/g,'"')
    .replace(/&amp;/g,'&')
    .replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function looksLikeUiText(value){
  const text=normalize(value)
  if(!text||NON_TRANSLATABLE.has(text))return false
  if(!/[A-Za-zÀ-ÿ]/.test(text))return false
  if(/^https?:\/\//i.test(text)||text.startsWith('/')||text.includes('@'))return false
  if(/^[.#]?[a-z0-9_/-]+\.(tsx?|jsx?|css|json|mjs|png|jpe?g|webp|svg|pdf)$/i.test(text))return false
  if(/^#[0-9a-f]{3,8}$/i.test(text)||/^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)?$/i.test(text))return false
  if(/[{}]/.test(text)||/\b(?:const|return|await|async|Promise|Record|Map|Set)\b/.test(text))return false
  if(/===|!==|=>|\?\.|\.map\(|\.filter\(|\.includes\(/.test(text))return false
  return true
}

async function filesUnder(dir){
  const out=[]
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())out.push(...await filesUnder(full))
    else if(entry.isFile()&&full.endsWith('.tsx'))out.push(full)
  }
  return out
}

function hasNoTranslate(node){
  if(!ts.isJsxElement(node)&&!ts.isJsxSelfClosingElement(node))return false
  const attrs=ts.isJsxElement(node)?node.openingElement.attributes.properties:node.attributes.properties
  return attrs.some(attr=>ts.isJsxAttribute(attr)&&attr.name.text==='data-no-translate')
}

function addLiteralStrings(node,sourceFile,out,file){
  const walk=current=>{
    if(ts.isStringLiteral(current)||ts.isNoSubstitutionTemplateLiteral(current)){
      const value=normalize(current.text)
      if(looksLikeUiText(value))out.push({value,file})
      return
    }
    ts.forEachChild(current,walk)
  }
  walk(node)
}

function collectFromSource(file,source,out){
  const sourceFile=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const visit=(node,blocked=false)=>{
    const nextBlocked=blocked||hasNoTranslate(node)
    if(nextBlocked)return

    if(ts.isJsxText(node)){
      const value=normalize(node.getText(sourceFile))
      if(looksLikeUiText(value))out.push({value,file})
      return
    }

    if(ts.isJsxAttribute(node)){
      const name=node.name.text
      if(TRANSLATABLE_ATTRIBUTES.has(name)&&node.initializer&&ts.isStringLiteral(node.initializer)){
        const value=normalize(node.initializer.text)
        if(looksLikeUiText(value))out.push({value,file})
      }else if(!SKIP_ATTRIBUTE_EXPRESSIONS.has(name)&&node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression){
        addLiteralStrings(node.initializer.expression,sourceFile,out,file)
      }
      return
    }

    if(ts.isJsxExpression(node)&&node.expression&&!ts.isJsxAttribute(node.parent)){
      addLiteralStrings(node.expression,sourceFile,out,file)
      return
    }

    ts.forEachChild(node,child=>visit(child,nextBlocked))
  }
  visit(sourceFile)
}

function translationKeys(source){
  return new Set([...source.matchAll(/^\s{2}["']([^"']+)["']\s*:\s*\{/gm)].map(match=>normalize(match[1])))
}

test('every static visible UI string has FR EN and DE coverage', async()=>{
  const [extension,complete]=await Promise.all([
    readFile(path.join(ROOT,'lib/ui-translation-extensions.ts'),'utf8'),
    readFile(path.join(ROOT,'lib/ui-translation-complete.ts'),'utf8'),
  ])
  const translated=new Set([...translationKeys(extension),...translationKeys(complete)])
  const files=[
    ...await filesUnder(path.join(ROOT,'app')),
    ...await filesUnder(path.join(ROOT,'components')),
  ]
  const found=[]
  for(const file of files)collectFromSource(path.relative(ROOT,file),await readFile(file,'utf8'),found)
  const missing=[...new Map(found.filter(item=>!translated.has(item.value)).map(item=>[item.value,item])).values()]
    .sort((a,b)=>a.value.localeCompare(b.value,'nl'))
  assert.equal(
    missing.length,
    0,
    'Missing four-language UI translations:\n'+missing.slice(0,120).map(item=>`- ${item.value} (${item.file})`).join('\n')
  )
})
