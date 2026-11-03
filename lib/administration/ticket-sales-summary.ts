/** Validate database RPC results before displaying or exporting financial totals. */
export type TicketSalesSummary={event_id:string;source:string;sale_rows:string;quantity:string;gross_cents:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nonNegativeInteger=(value:unknown):value is string=>typeof value==='string'&&/^\d+$/.test(value)&&BigInt(value)<=BigInt(Number.MAX_SAFE_INTEGER)
export function validateTicketSalesSummary(value:unknown):value is TicketSalesSummary[]{
 if(!Array.isArray(value)||value.length>10000)return false
 return value.every((row:unknown)=>{
  if(!row||typeof row!=='object')return false
  const r=row as Record<string,unknown>
  return typeof r.event_id==='string'&&uuid.test(r.event_id)
   &&typeof r.source==='string'&&r.source.length>0&&r.source.length<=160
   &&nonNegativeInteger(r.sale_rows)&&nonNegativeInteger(r.quantity)&&nonNegativeInteger(r.gross_cents)
 })
}
