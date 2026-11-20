import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const source=await readFile(new URL('../components/error-report-bridge.tsx',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText

test('background errors remain compact until the user opens the report',()=>{
  const states=[],listeners=new Map()
  let cursor=0,mounted=false,tree,locale='en'
  const jsx=(type,props)=>({type,props})
  const context={exports:{},queueMicrotask:fn=>fn(),
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
    require(name){
      if(name==='react')return {
        useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=value}]},
        useEffect(fn){if(!mounted)fn()},
      }
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}
      if(name==='@/lib/locale-preferences')return {activeUiLocale:()=>locale,LANGUAGE_APPLIED_EVENT:'language'}
      if(name==='@/components/error-report-button')return {ErrorReportButton:'report-submit'}
      throw Error(name)
    },
  }
  context.window=context
  vm.runInNewContext(compiled,context)
  const render=()=>{cursor=0;tree=context.exports.ErrorReportBridge();mounted=true;return tree}
  const nodes=node=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(nodes)]:[]
  assert.equal(render(),null)
  listeners.get('error')({message:'A background operation failed'})
  render()
  assert.equal(nodes(tree).filter(node=>node.type==='section').length,0)
  let button=nodes(tree).find(node=>node.type==='button')
  assert.equal(button.props.children,'Report error')
  assert.equal(button.props['aria-expanded'],false)
  assert.match(tree.props.className,/pointer-events-none/)
  locale='fr';listeners.get('language')();render()
  button=nodes(tree).find(node=>node.type==='button')
  assert.equal(button.props.children,'Signaler une erreur')
  button.props.onClick();render()
  assert.equal(nodes(tree).filter(node=>node.type==='section').length,1)
  assert.equal(nodes(tree).find(node=>node.type==='report-submit').props.errorMessage,'A background operation failed')
  nodes(tree).find(node=>node.type==='button'&&node.props['aria-label']).props.onClick()
  assert.equal(render(),null)
})
