// Main-QA-only, read-only bridge from the existing Main hostname to the
// isolated Hono Worker. Never forward cookies, session secrets, arbitrary
// paths, mutating methods or production traffic.
export const dynamic = 'force-dynamic'

const MAIN_ORIGIN = 'https://uptilldawn-main.uptilldawn.workers.dev'
const MODERN_API_ORIGIN = 'https://uptilldawn-modern-main.uptilldawn.workers.dev'
const READ_ONLY_ENDPOINTS = new Set([
  'health', 'session', 'god/diagnostics', 'integrations/status',
])
const json = (status:number,error:string) => new Response(JSON.stringify({error}),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},
})

export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
  if(process.env.NEXT_PUBLIC_APP_URL!==MAIN_ORIGIN)return json(404,'not_found')
  const pieces=(await params).path
  if(!Array.isArray(pieces)||pieces.length>2)return json(404,'not_found')
  const endpoint=pieces.join('/')
  if(!READ_ONLY_ENDPOINTS.has(endpoint))return json(404,'not_found')
  const authorization=request.headers.get('authorization')||''
  if(endpoint!=='health'&&!/^Bearer [A-Za-z0-9._~+-]{30,8192}$/.test(authorization))
    return json(401,'authentication_required')
  try{
    const response=await fetch(MODERN_API_ORIGIN+'/api/v1/'+endpoint,{
      method:'GET',redirect:'manual',cache:'no-store',
      headers:authorization&&endpoint!=='health'
        ? {'Authorization':authorization,'Accept':'application/json'}
        : {'Accept':'application/json'},
      signal:AbortSignal.timeout(12000),
    })
    if(response.status>=300&&response.status<400)return json(502,'upstream_redirect_denied')
    if(!(response.headers.get('content-type')||'').includes('application/json'))
      return json(502,'upstream_not_json')
    const content=await response.text()
    if(new TextEncoder().encode(content).byteLength>65536)
      return json(502,'upstream_response_too_large')
    return new Response(content,{status:response.status,headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }})
  }catch{
    return json(503,'modern_qa_unavailable')
  }
}
