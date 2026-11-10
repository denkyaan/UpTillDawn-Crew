import {z} from 'zod'
import {authorizeStudio,studioFailure,studioResponse} from '@/lib/god-studio-server'

const schema=z.object({limit:z.coerce.number().int().min(1).max(100).default(50)})
export async function GET(request:Request){
 try{
  const {client,token}=await authorizeStudio(request)
  const params=new URL(request.url).searchParams
  const {limit}=schema.parse({limit:params.get('limit')||50})
  const {data,error}=await client.rpc('upt_god_maker_log_snapshot',{
   p_token:token,p_limit:limit,
  })
  if(error)throw error
  if(!data||typeof data!=='object')throw Error('No log snapshot')
  return studioResponse({logs:data,source:'main-test database'})
 }catch(error){
  if(error instanceof z.ZodError)return studioResponse({error:'Ongeldige logaanvraag.'},400)
  return studioFailure(error)
 }
}
