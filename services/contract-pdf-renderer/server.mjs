import {createServer} from 'node:http'
import {timingSafeEqual} from 'node:crypto'
import {chromium} from 'playwright'

const port=Number(process.env.PORT||8080)
const secret=process.env.CONTRACT_PDF_RENDER_TOKEN
if(!secret||Buffer.byteLength(secret)<32||/[\r\n]/.test(secret))throw Error('CONTRACT_PDF_RENDER_TOKEN must be at least 32 bytes')
const maxHtml=512_000
const maxPdf=15*1024*1024
const expected=Buffer.from('Bearer '+secret)
function authorized(header){
 if(typeof header!=='string'||Buffer.byteLength(header)>4096)return false
 const actual=Buffer.from(header)
 return actual.length===expected.length&&timingSafeEqual(actual,expected)
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const server=createServer(async(req,res)=>{
 const reply=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(message)}
 if(req.method!=='POST'||req.url!=='/')return reply(404,'Not found')
 if(!authorized(req.headers.authorization))return reply(401,'Unauthorized')
 if(!/^text\/html(?:\s*;|$)/i.test(req.headers['content-type']||''))return reply(415,'Expected text/html')
 let page
 try{
  const chunks=[]
  let size=0
  for await(const chunk of req){
   size+=chunk.length
   if(size>maxHtml)return reply(413,'HTML too large')
   chunks.push(chunk)
  }
  const html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
  if(!html.trim())return reply(400,'Empty document')
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',acceptDownloads:false})
  try{
   page=await context.newPage()
   await page.route('**/*',route=>{
    const url=route.request().url()
    if(url.startsWith('data:')||url.startsWith('about:'))return route.continue()
    return route.abort()
   })
   await page.setContent(html,{waitUntil:'load',timeout:15000})
   const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,timeout:20000})
   if(pdf.length<5||pdf.length>maxPdf||pdf.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF output')
   res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
   res.end(pdf)
  }finally{await context.close()}
 }catch(e){console.error('Contract PDF render failed:',e instanceof Error?e.message:'unknown');if(!res.headersSent)reply(500,'PDF rendering failed');else res.destroy()}
})
server.requestTimeout=35000
server.headersTimeout=10000
server.listen(port,'0.0.0.0')
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();browser.close().finally(()=>process.exit(0))})
