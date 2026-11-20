import {writeFileSync,mkdirSync,readFileSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
import {actionEntries,ts,root} from '../tooling/main-source.mjs'
const f=ts.factory,printer=ts.createPrinter()
const entries=actionEntries()
const groups=Map.groupBy(entries.filter(x=>x.inline),x=>x.file)
const outputs=new Map()
for(const [file,actions]of groups){
 const program=ts.createProgram([resolve(root,file)],{noResolve:true,target:ts.ScriptTarget.Latest,jsx:ts.JsxEmit.Preserve})
 const ast=program.getSourceFile(resolve(root,file)),checker=program.getTypeChecker(),declarations=new Map()
 const bind=(name,node)=>{const symbol=checker.getSymbolAtLocation(name);if(symbol)declarations.set(symbol,node)}
 for(const node of ast.statements){
  if(node.name&&ts.isIdentifier(node.name))bind(node.name,node)
  if(ts.isVariableStatement(node))for(const d of node.declarationList.declarations)if(ts.isIdentifier(d.name))bind(d.name,d)
  if(ts.isImportDeclaration(node)){
   const clause=node.importClause
   if(clause?.name)bind(clause.name,node)
   if(clause?.namedBindings){const b=clause.namedBindings;if(ts.isNamespaceImport(b))bind(b.name,node);else for(const e of b.elements)bind(e.name,node)}
  }
 }
 const names=new Set(actions.map(a=>a.name)),needed=new Set(),symbols=new Set(),pending=[]
 for(const node of ast.statements)if(ts.isFunctionDeclaration(node)&&names.has(node.name?.text))pending.push(checker.getSymbolAtLocation(node.name))
 while(pending.length){
  const symbol=pending.pop(),node=declarations.get(symbol)
  if(!node||symbols.has(symbol))continue
  symbols.add(symbol);needed.add(node)
  if(ts.isImportDeclaration(node))continue
  function walk(n){if(ts.isIdentifier(n)){const dependency=checker.getSymbolAtLocation(n);if(declarations.has(dependency)&&!symbols.has(dependency))pending.push(dependency)}ts.forEachChild(n,walk)}
  walk(node)
 }
 const used=name=>symbols.has(checker.getSymbolAtLocation(name))
 const nodes=ast.statements.flatMap(node=>{
  if(ts.isVariableStatement(node)){
   const kept=node.declarationList.declarations.filter(d=>needed.has(d))
   if(!kept.length)return []
   return [f.updateVariableStatement(node,node.modifiers,f.updateVariableDeclarationList(node.declarationList,kept))]
  }
  if(!needed.has(node))return []
  if(ts.isImportDeclaration(node)){
   const clause=node.importClause,b=clause?.namedBindings
   const bindings=b&&ts.isNamedImports(b)?f.updateNamedImports(b,b.elements.filter(e=>used(e.name))):b
   const newClause=clause?f.updateImportClause(clause,clause.isTypeOnly,clause.name&&used(clause.name)?clause.name:undefined,bindings):undefined
   const spec=node.moduleSpecifier.text
   const path=spec.startsWith('.')?'@/'+relative(root,resolve(root,dirname(file),spec)):spec
   return [f.updateImportDeclaration(node,node.modifiers,newClause,f.createStringLiteral(path),node.attributes)]
  }
  if(ts.isFunctionDeclaration(node)&&names.has(node.name?.text))return [f.updateFunctionDeclaration(node,[f.createModifier(ts.SyntaxKind.ExportKeyword),...(node.modifiers??[]).filter(m=>m.kind!==ts.SyntaxKind.ExportKeyword&&m.kind!==ts.SyntaxKind.DefaultKeyword)],node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,node.body)]
  return [node]
 })
 const path='lib/migration/generated/'+file.replace(/\.(tsx?|jsx?)$/,'').replaceAll('/','__').replaceAll(/[()[\]]/g,'_')+'.ts'
 const output='// Generated from '+file+' by modern/scripts/generate-original-actions.mjs. Do not edit.\nimport "server-only"\n'+nodes.map(n=>printer.printNode(ts.EmitHint.Unspecified,n,ast)).join('\n')+'\n'
 outputs.set(path,output)
 for(const action of actions)action.module=path
}
const lines=entries.map(a=>`${JSON.stringify(a.id)}:()=>import(${JSON.stringify('@/'+(a.module??a.file).replace(/\.ts$/,''))}).then(m=>m.${a.name} as unknown as OriginalAction)`)
outputs.set('lib/migration/original-action-registry.ts','// Generated static allowlist. No caller-selected module loading.\nimport "server-only"\nexport type OriginalAction=(...args:unknown[])=>unknown|Promise<unknown>\nexport const originalActions:Readonly<Record<string,()=>Promise<OriginalAction>>>={\n'+lines.join(',\n')+'\n}\n')
let stale=false
for(const [file,content]of outputs){
 const path=resolve(root,file)
 if(process.argv.includes('--check')){
  let current='';try{current=readFileSync(path,'utf8')}catch{}
  if(current!==content){console.error('Stale generated action module: '+file);stale=true}
 }else{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content)}
}
if(stale)process.exitCode=1
console.log(JSON.stringify({sourceModules:groups.size,originalActions:entries.length,generatedFiles:outputs.size,fresh:!stale}))
