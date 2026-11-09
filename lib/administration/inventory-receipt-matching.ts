/**
 * Conservative purchase-to-inventory suggestions. Exact normalized names only;
 * an unmatched, duplicate or fractional line is never booked automatically.
 * Database receipt RPCs remain authoritative for approval, event and amount.
 */
export type PurchaseInvoiceLine={
 id:string;document_id:string;description:string;quantity:number
}
export type PurchasableInventoryItem={
 id:string;event_id:string;name:string
}
export type InventoryReceiptRow={line_id:string;quantity:number}
export type InventoryReceiptProposal={
 line:string;item:string;quantity:number;description:string;itemName:string
}
const key=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('nl-BE')
 .trim().replace(/\s+/g,' ')

export function proposeExactInventoryReceipts(
 document:{id:string;event_id:string|null},
 lines:readonly PurchaseInvoiceLine[],
 items:readonly PurchasableInventoryItem[],
 receipts:readonly InventoryReceiptRow[],
):InventoryReceiptProposal[]{
 if(!document.event_id)return []
 const eventItems=items.filter(item=>item.event_id===document.event_id)
 const byName=new Map<string,PurchasableInventoryItem[]>()
 for(const item of eventItems){
  const name=key(item.name)
  byName.set(name,[...(byName.get(name)??[]),item])
 }
 const received=new Map<string,number>()
 for(const entry of receipts){
  if(!Number.isSafeInteger(entry.quantity)||entry.quantity<0)continue
  received.set(entry.line_id,(received.get(entry.line_id)??0)+entry.quantity)
 }
 return lines.flatMap(line=>{
  if(line.document_id!==document.id)return []
  const matches=byName.get(key(line.description))??[]
  if(matches.length!==1)return []
  const purchased=Number(line.quantity)
  const remainder=purchased-(received.get(line.id)??0)
  if(!Number.isSafeInteger(purchased)||purchased<=0||
    !Number.isSafeInteger(remainder)||remainder<1||remainder>100000)return []
  return [{
   line:line.id,item:matches[0].id,quantity:remainder,
   description:line.description,itemName:matches[0].name,
  }]
 })
}
