import {Buffer} from 'node:buffer'
import ExcelJS from 'exceljs'
import {z} from 'zod'
import {createClient} from '@/lib/supabase/crew-server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const uuid=z.string().uuid()

function normalize(value:unknown){
  return String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
}

function pick(row:Record<string,string>,keys:string[]){
  for(const key of keys){
    const value=row[key]
    if(value?.trim())return value.trim()
  }
  return ''
}

function mapRow(row:Record<string,string>){
  const artistName=pick(row,['artist','artiest'])
  const guestName=pick(row,['guest','gast'])
  const name=pick(row,['name','naam'])||artistName||guestName
  const typeRaw=normalize(pick(row,['type','soort','category','categorie']))
  const type=artistName?'artist':guestName?'guest':['artist','artiest','performer'].includes(typeRaw)?'artist':'guest'
  const spots=pick(row,['spots','guest spots','guest_spots','plaatsen','aantal','qty','quantity'])||'1'
  const notes=pick(row,['notes','note','notitie','opmerking','remarks'])
  const drinks=pick(row,['drinks','drink','drank','beverage','hospitality'])
  const hospitalityNotes=pick(row,['hospitality notes','hospitality_notes','backstage notes','backstage_notes','backstage'])
  return {name,type,spots,notes,drinks,hospitality_notes:hospitalityNotes}
}

function rowsFromMatrix(matrix:string[][]){
  if(!matrix.length)return []
  const known=new Set(['name','naam','artist','artiest','guest','gast','type','soort','spots','plaatsen','aantal','drank','drinks','hospitality','notes','notitie'])
  const first=matrix[0].map(normalize)
  const hasHeader=first.some(value=>known.has(value))
  const headers=hasHeader
    ? first.map((value,index)=>value||'column_'+index)
    : ['name','type','spots','drinks','notes','hospitality_notes']
  const data=hasHeader?matrix.slice(1):matrix
  return data.map(values=>{
    const row:Record<string,string>={}
    headers.forEach((header,index)=>{row[header]=values[index]||''})
    return mapRow(row)
  }).filter(row=>row.name)
}

function parseDelimited(text:string){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim())
  if(!lines.length)return []
  const sample=lines[0]
  const delimiter=sample.includes('\t')?'\t':sample.includes(';')?';':','
  return rowsFromMatrix(lines.map(line=>line.split(delimiter).map(cell=>cell.trim().replace(/^"(.*)"$/,'$1').replace(/""/g,'"'))))
}

async function parseUpload(file:File){
  const name=file.name.toLowerCase()
  if(file.size>5_000_000)throw new Error('Bestand is groter dan 5 MB.')
  if(name.endsWith('.xlsx')){
    const wb=new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()))
    const ws=wb.worksheets[0]
    if(!ws)throw new Error('Excelbestand bevat geen werkblad.')
    const matrix:string[][]=[]
    ws.eachRow({includeEmpty:false},row=>{
      const values=Array.isArray(row.values)?row.values:[]
      matrix.push(values.slice(1).map(value=>{
        if(value&&typeof value==='object'&&'text' in value)return String((value as {text?:unknown}).text??'')
        if(value&&typeof value==='object'&&'result' in value)return String((value as {result?:unknown}).result??'')
        return String(value??'')
      }))
    })
    return rowsFromMatrix(matrix)
  }
  if(name.endsWith('.csv')||name.endsWith('.txt')){
    return parseDelimited(await file.text())
  }
  throw new Error('Gebruik een XLSX-, CSV- of TXT-bestand.')
}

export async function POST(request:Request){
  const site=request.headers.get('sec-fetch-site')
  const origin=request.headers.get('origin')
  if(site==='cross-site'||Boolean(origin&&origin!==new URL(request.url).origin)){
    return Response.json({error:'Ongeldige oorsprong.'},{status:403})
  }

  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)return Response.json({error:'Aanmelden vereist.'},{status:401})
  const [{data:approved},{data:isAdmin}]=await Promise.all([
    s.rpc('upt_is_approved'),
    s.rpc('upt_is_admin',{uid:user.id}),
  ])
  if(!approved||!isAdmin)return Response.json({error:'Geen toegang.'},{status:403})

  const form=await request.formData()
  const eventId=uuid.safeParse(form.get('event_id'))
  const file=form.get('file')
  if(!eventId.success||!(file instanceof File)){
    return Response.json({error:'Evenement en bestand zijn verplicht.'},{status:400})
  }

  try{
    const entries=await parseUpload(file)
    if(!entries.length)return Response.json({error:'Geen bruikbare guestlistregels gevonden.'},{status:400})
    if(entries.length>1000)return Response.json({error:'Maximaal 1000 regels per import.'},{status:400})

    const {data,error}=await s.rpc('upt_guestlist_import',{
      p_event:eventId.data,
      p_entries:entries,
      p_source_document:file.name.slice(0,255),
    })
    if(error)throw new Error(error.message)
    const result=(data&&typeof data==='object'&&!Array.isArray(data)?data:{}) as Record<string,unknown>
    return Response.json({
      inserted:Number(result.inserted||0),
      duplicates:Number(result.duplicates||0),
      supplemented:Number(result.supplemented||0),
    })
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'Guestlist kon niet worden geïmporteerd.'},{status:400})
  }
}
