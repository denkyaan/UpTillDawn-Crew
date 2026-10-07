import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import * as training from '../lib/tour-training.ts'
import * as panelLayout from '../lib/tour-panel-layout.ts'

const source=await readFile(new URL('../components/training/tour-control-center.tsx',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText

// Execute the real component and its effects with controlled browser timing.
function harness({visible=true,locale='en',chapter='overview',startPath}={}){
  const slots=[],effects=[],listeners=new Map(),frames=new Map(),timers=new Map(),requests=[],routes=[],observers=[]
  let cursor=0,dirty=true,tree,nextId=1,pathname=startPath||(chapter==='settings'?'/settings':'/')
  const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}}
  const localStorage=storage(),sessionStorage=storage()
  const progressKey=training.tourProgressKey('test-user','employee')
  localStorage.setItem(progressKey,JSON.stringify({version:training.TOUR_VERSION,activeKey:chapter,completed:[],skipped:[],paused:false}))
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]))
  const hooks={
    useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true}}]},
    useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial})},
    useMemo(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value},
    useCallback(fn,deps){return hooks.useMemo(()=>fn,deps)},
    useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const prior=slots[i];slots[i]={deps};effects.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn()})}},
  }
  const jsx=(type,props)=>({type,props})
  const router={push:route=>routes.push(route)}
  const dispatchEvent=event=>{for(const fn of [...(listeners.get(event.type)||[])])fn(event);return true}
  const rect={left:10,top:80,width:180,height:40}
  const element={matches:()=>false,querySelector:()=>null,scrollIntoView(){},getBoundingClientRect:()=>rect,getClientRects:()=>visible?[rect]:[]}
  const context={exports:{},require(name){if(name==='react')return hooks;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};if(name==='next/navigation')return {useRouter:()=>router,usePathname:()=>pathname};if(name==='@/lib/tour-training')return training;if(name==='@/lib/tour-panel-layout')return panelLayout;if(name==='@/lib/locale-preferences')return {activeUiLocale:()=>locale,LANGUAGE_APPLIED_EVENT:'language'};throw Error(name)},
    localStorage,sessionStorage,location:{pathname,search:'?tour=1'},innerWidth:390,innerHeight:844,
    fetch:async(url,options)=>{requests.push({url,...options});return {ok:true}},
    document:{querySelector:()=>visible?element:null,body:{}},
    matchMedia:()=>({matches:true}),getComputedStyle:()=>({display:'block',visibility:'visible'}),
    requestAnimationFrame(fn){const id=nextId++;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout(fn){const id=nextId++;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},
    removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn),dispatchEvent,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    HTMLElement:class{},
    ResizeObserver:class{constructor(fn){this.fn=fn}observe(){}disconnect(){}},
    MutationObserver:class{constructor(fn){this.fn=fn;this.connected=false;observers.push(this)}observe(){this.connected=true}disconnect(){this.connected=false}},
  }
  Object.setPrototypeOf(element,context.HTMLElement.prototype)
  context.window=context
  vm.runInNewContext(compiled,context)
  function flush(){
    for(let n=0;n<30;n++){
      if(dirty){dirty=false;cursor=0;tree=context.exports.TourControlCenter({active:true,userId:'test-user',role:'employee',preferredWorkplace:''})}
      while(effects.length)effects.shift()()
      if(frames.size){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}
      if(!dirty&&!effects.length&&!frames.size)return
    }
    throw Error('Tour render loop')
  }
  const nodes=node=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(child=>nodes(child))]:[]
  const text=node=>node==null||typeof node==='boolean'?'':typeof node!=='object'?String(node):[node.props?.children].flat(Infinity).map(text).join(' ')
  flush()
  return {
    requests,routes,observers,sessionStorage,
    progress:()=>JSON.parse(localStorage.getItem(progressKey)),
    button:name=>nodes(tree).find(node=>node.type==='button'&&(text(node)===name||node.props['aria-label']===name)),
    text:()=>text(tree),
    click(name){const button=this.button(name);assert.ok(button,`Missing button: ${name}`);button.props.onClick();flush()},
    emit(name,detail){dispatchEvent(new context.CustomEvent(name,{detail}));flush()},
    navigate(path){pathname=path;dirty=true;flush()},
    timeout(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());flush()},
    reveal(){visible=true;for(const observer of observers)if(observer.connected)observer.fn();flush()},
    unmount(){for(const slot of slots)slot?.cleanup?.()},
  }
}

test('tour stays compact and reveals contextual information only after the highlighted action',()=>{
  const app=harness({locale:'en'})
  assert.ok(!app.text().includes('Learn to read the live event'))
  app.emit('uptilldawn-training-nav-target',{target:'crew'})
  assert.match(app.text(),/Learn to read the live event/)
  app.unmount()
})

test('a late tour target recovers after timeout and reports only once',()=>{
  const app=harness({visible:false})
  app.timeout()
  assert.equal(app.requests.length,1)
  assert.equal(app.requests[0].url,'/api/error-reports')
  assert.equal(JSON.parse(app.requests[0].body).errorName,'TourTargetMissing')
  assert.ok(app.button('SKIP'))
  assert.ok(app.observers.some(observer=>observer.connected))
  app.reveal()
  assert.equal(app.button('SKIP'),undefined)
  assert.ok(!app.text().includes('Perform the highlighted action'))
  assert.equal(app.requests.length,1)
  app.unmount()
  assert.ok(app.observers.every(observer=>!observer.connected))
})

test('action navigation keeps its new chapter while Next commits the route',()=>{
  const app=harness()
  app.emit('uptilldawn-training-nav-target',{target:'events'})
  assert.equal(app.progress().activeKey,'crew')
  assert.deepEqual(app.progress().completed,['overview'])
  assert.deepEqual(app.routes,['/?tour=1','/events?tour=1'])
  app.navigate('/events')
  assert.equal(app.progress().activeKey,'events')
  assert.deepEqual(app.routes,['/?tour=1','/events?tour=1'])
  app.unmount()
})

test('missing-target skip records skipped instead of falsely completing the chapter',()=>{
  const app=harness({visible:false})
  assert.equal(app.button('SKIP'),undefined)
  app.timeout()
  app.click('SKIP')
  assert.deepEqual(app.progress().skipped,['overview'])
  assert.deepEqual(app.progress().completed,[])
  assert.equal(app.progress().activeKey,'events')
  app.unmount()
})

test('skipping an unavailable final chapter pauses instead of claiming tour completion',()=>{
  const app=harness({visible:false,chapter:'crew'})
  app.timeout()
  app.click('SKIP')
  assert.equal(app.progress().paused,true)
  assert.deepEqual(app.progress().completed,[])
  assert.equal(app.sessionStorage.getItem(training.TOUR_SESSION_KEY),null)
  app.unmount()
})


test('starting a saved tour from settings opens its saved chapter without completing another',()=>{
  const app=harness({startPath:'/settings'})
  assert.equal(app.progress().activeKey,'overview')
  assert.deepEqual(app.progress().completed,[])
  assert.deepEqual(app.routes,['/?tour=1'])
  app.navigate('/')
  assert.equal(app.progress().activeKey,'overview')
  app.unmount()
})


test('tour chrome remains compact and does not render the legacy blocking panel',async()=>{
  const source=await readFile(new URL('../components/training/tour-control-center.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(source,/tourPanelLayout\(/)
  assert.doesNotMatch(source,/DO THIS NOW|DOE DIT NU/)
  assert.match(source,/actionFeedback/)
})
