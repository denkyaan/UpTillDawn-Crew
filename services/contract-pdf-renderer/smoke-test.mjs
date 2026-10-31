import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'

const token=randomBytes(40).toString('hex')
const port=18080+Math.floor(Math.random()*1000)
const url=`http://127.0.0.1:${port}/`
const child=spawn(process.execPath,['server.mjs'],{
 cwd:new URL('.',import.meta.url).pathname,
 env:{...process.env,PORT:String(port),CONTRACT_PDF_RENDER_TOKEN:token},
 stdio:['ignore','pipe','pipe']
})
let stderr=''
child.stderr.on('data',chunk=>{stderr+=chunk.toString()})
async function request(body,headers={}){
 return fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'text/html',...headers},body,signal:AbortSignal.timeout(25000)})
}
try{
 let ready=false
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw Error('Renderer exited: '+stderr)
  try{const res=await fetch(url,{signal:AbortSignal.timeout(500)});if(res.status===404){ready=true;break}}catch{}
  await delay(250)
 }
 assert.ok(ready,'Renderer did not become ready: '+stderr)
 const unauthorized=await fetch(url,{method:'POST',body:'<p>x</p>',headers:{'Content-Type':'text/html'}})
 assert.equal(unauthorized.status,401)
 const wrongType=await request('hello',{'Content-Type':'text/plain'})
 assert.equal(wrongType.status,415)
 const invalidUtf8=await request(new Uint8Array([0xc3,0x28]))
 assert.equal(invalidUtf8.status,400)
 const empty=await request(' ')
 assert.equal(empty.status,400)
 const oversized=await request('x'.repeat(512001))
 assert.equal(oversized.status,413)
 const rendered=await request('<!doctype html><html><body><h1>Contract test</h1><p>Unicode: é €</p></body></html>')
 assert.equal(rendered.status,200)
 assert.match(rendered.headers.get('content-type')||'',/^application\/pdf/)
 const pdf=new Uint8Array(await rendered.arrayBuffer())
 assert.equal(new TextDecoder().decode(pdf.slice(0,5)),'%PDF-')
 assert.ok(pdf.byteLength>100,'PDF should not be empty')
 console.log('Contract PDF renderer smoke test passed')
}finally{
 child.kill('SIGTERM')
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)])
 if(child.exitCode===null)child.kill('SIGKILL')
}
