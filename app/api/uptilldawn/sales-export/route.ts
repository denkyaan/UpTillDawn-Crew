import {NextResponse} from 'next/server'
import ExcelJS from 'exceljs'
import {z} from 'zod'
import {createClient} from '@/lib/supabase/crew-server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function safe(value:unknown){
  const text=value==null?'':String(value)
  return /^[=+\-@]/.test(text)?`'${text}`:text
}

function money(cents:number){
  return Math.round(cents)/100
}

export async function GET(request:Request){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)return new NextResponse('Aanmelden vereist.',{status:401})
  const [{data:approved},{data:isAdmin}]=await Promise.all([
    s.rpc('upt_is_approved'),
    s.rpc('upt_is_admin',{uid:user.id}),
  ])
  if(!approved||!isAdmin)return new NextResponse('Geen toegang.',{status:403})

  const eventId=z.string().uuid().safeParse(new URL(request.url).searchParams.get('event'))
  if(!eventId.success)return new NextResponse('Ongeldig evenement.',{status:400})

  const [eventResult,transactionsResult,registersResult,workplacesResult,peopleResult]=await Promise.all([
    s.from('events').select('id,name,start_at,end_at').eq('id',eventId.data).single(),
    s.from('sales_transactions').select('*').eq('event_id',eventId.data).order('created_at'),
    s.from('sales_registers').select('*').eq('event_id',eventId.data),
    s.from('workplaces').select('id,name').eq('event_id',eventId.data),
    s.rpc('upt_admin_personnel_details_v2'),
  ])
  if(eventResult.error||transactionsResult.error||registersResult.error||workplacesResult.error||peopleResult.error){
    return new NextResponse('Salesexport kon niet volledig worden geladen.',{status:503})
  }

  const event=eventResult.data
  const transactions=transactionsResult.data||[]
  const registers=registersResult.data||[]
  const workplaces=workplacesResult.data||[]
  const people=peopleResult.data||[]
  const workplaceName=new Map(workplaces.map(row=>[row.id,row.name]))
  const personName=new Map(people.map(row=>[row.id,row.full_name||row.email||'Personeelslid']))
  const sign=(tx:{transaction_type:string})=>tx.transaction_type==='refund'?-1:1

  const wb=new ExcelJS.Workbook()
  wb.creator='Up Till Dawn Crew'
  wb.created=new Date()

  const txSheet=wb.addWorksheet('Transacties')
  txSheet.columns=[
    {header:'Datum/tijd',key:'time',width:22},
    {header:'Evenement',key:'event',width:28},
    {header:'Werkplek/kassa',key:'workplace',width:24},
    {header:'Item',key:'item',width:28},
    {header:'Categorie',key:'category',width:14},
    {header:'Type',key:'type',width:14},
    {header:'Aantal',key:'quantity',width:10},
    {header:'Prijs/stuk',key:'unit',width:14},
    {header:'Totaal',key:'total',width:14},
    {header:'Betaalmethode',key:'payment',width:16},
    {header:'Medewerker',key:'seller',width:24},
    {header:'Notitie',key:'notes',width:36},
  ]
  for(const tx of transactions){
    txSheet.addRow({
      time:new Date(tx.created_at),
      event:safe(event.name),
      workplace:safe(workplaceName.get(tx.workplace_id)||'Werkplek'),
      item:safe(tx.product_name),
      category:tx.sale_category==='merch'?'Merch':'Token',
      type:tx.transaction_type==='refund'?'Refund':'Verkoop',
      quantity:sign(tx)*tx.quantity,
      unit:money(tx.unit_price_cents),
      total:sign(tx)*money(Number(tx.total_cents)),
      payment:tx.payment_method==='cash'?'Cash':'Kaart',
      seller:safe(tx.seller_id?personName.get(tx.seller_id)||'Personeelslid':'—'),
      notes:safe(tx.notes),
    })
  }
  txSheet.getRow(1).font={bold:true}
  txSheet.views=[{state:'frozen',ySplit:1}]
  txSheet.autoFilter={from:'A1',to:'L1'}
  txSheet.getColumn('unit').numFmt='€ #,##0.00'
  txSheet.getColumn('total').numFmt='€ #,##0.00'

  const summary=wb.addWorksheet('Samenvatting')
  const net=(filter:(tx:(typeof transactions)[number])=>boolean)=>transactions.filter(filter).reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  summary.addRows([
    ['Evenement',safe(event.name)],
    ['Start',new Date(event.start_at)],
    ['Einde',new Date(event.end_at)],
    [],
    ['Netto omzet',money(net(()=>true))],
    ['Cash',money(net(tx=>tx.payment_method==='cash'))],
    ['Kaart',money(net(tx=>tx.payment_method==='card'))],
    ['Merch',money(net(tx=>tx.sale_category==='merch'))],
    ['Tokens',money(net(tx=>tx.sale_category==='token'))],
  ])
  summary.getColumn(1).width=28
  summary.getColumn(2).width=28
  for(let row=5;row<=9;row++)summary.getCell(row,2).numFmt='€ #,##0.00'

  summary.addRow([])
  summary.addRow(['Kassa/werkplek','Begininhoud cash','Netto cashverkopen','Verwachte cash'])
  summary.getRow(summary.rowCount).font={bold:true}
  for(const register of registers){
    const cash=net(tx=>tx.workplace_id===register.workplace_id&&tx.payment_method==='cash')
    const row=summary.addRow([
      safe(workplaceName.get(register.workplace_id)||'Kassa'),
      money(register.opening_cash_cents),
      money(cash),
      money(register.opening_cash_cents+cash),
    ])
    for(let col=2;col<=4;col++)row.getCell(col).numFmt='€ #,##0.00'
  }

  const buffer=await wb.xlsx.writeBuffer()
  return new NextResponse(new Uint8Array(buffer),{
    headers:{
      'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition':`attachment; filename="uptilldawn-sales-${event.id}.xlsx"`,
      'cache-control':'private, no-store',
    },
  })
}
