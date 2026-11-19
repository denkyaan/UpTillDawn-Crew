import type {FinancialDocument,FinancialPayment,InventoryItem} from "../lib/operational-reads"

export type AdministrationSnapshot={
 documents:readonly FinancialDocument[]
 payments:readonly FinancialPayment[]
 inventory:readonly InventoryItem[]
}
export type AdministrationPriority={
 kind:"due"|"peppol"|"stock"
 name:string
 detail:string
 status:string
}
export type AdministrationPulse={
 documents:number;payments:number;items:number;overdue:number;peppolIssues:number;stockIssues:number
 priorities:AdministrationPriority[]
}
const openStatuses=new Set(["draft","issued","sent","pending","approved","overdue","partially_paid","partial"])
const peppolIssues=new Set(["failed","error","rejected","retry","blocked"])
const status=(value:unknown):string=>typeof value==="string"?value.trim().toLowerCase():""
const isoDay=/^\d{4}-\d{2}-\d{2}$/
export function summarizeAdministration(data:AdministrationSnapshot,today:string):AdministrationPulse{
 if(!isoDay.test(today))throw Error("invalid_local_date")
 let overdue=0,peppol=0,stock=0
 const priorities:AdministrationPriority[]=[]
 for(const doc of data.documents.slice(0,100)){
  const current=status(doc.status)
  const due=typeof doc.due_date==="string"?doc.due_date:""
  const hasOverdue=isoDay.test(due)&&due<today&&openStatuses.has(current)
  const peppolIssue=peppolIssues.has(status(doc.peppol_status))
  if(hasOverdue){
   overdue++
   if(priorities.length<8)priorities.push({kind:"due",
    name:doc.document_number||doc.kind,detail:due,status:doc.status})
  }
  if(peppolIssue){
   peppol++
   if(priorities.length<8)priorities.push({kind:"peppol",
    name:doc.document_number||doc.kind,detail:doc.peppol_status||"",status:doc.status})
  }
 }
 for(const item of data.inventory.slice(0,100)){
  const shortage=item.missing_quantity>0||item.damaged_quantity>0||item.available_quantity===0
  if(shortage){
   stock++
   if(priorities.length<8)priorities.push({kind:"stock",name:item.name,
    detail:String(item.missing_quantity)+" / "+String(item.damaged_quantity),
    status:String(item.available_quantity)})
  }
 }
 return {documents:Math.min(data.documents.length,100),payments:Math.min(data.payments.length,100),
  items:Math.min(data.inventory.length,100),overdue,peppolIssues:peppol,stockIssues:stock,
  priorities}
}
export function currentBelgianDate(now:Date):string{
 return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Brussels",
  year:"numeric",month:"2-digit",day:"2-digit"}).format(now)
}
