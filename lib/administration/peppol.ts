import {peppolCountries,peppolCurrencies,peppolEndpointSchemes,peppolUnits} from './peppol-codes.ts'

export type PeppolParty={name:string;street_address:string;postal_code:string;city:string;country_code:string;enterprise_number:string;vat_number:string;peppol_endpoint:string;iban?:string;tax_registration?:string}
export type PeppolLine={id:string;description:string;quantity:string|number;unit_price:string|number;vat_rate:string|number;unit_code?:string|null;vat_category?:string|null;vat_exemption_reason?:string|null}
export type PeppolDocument={id:string;kind:string;status:string;document_number:string|null;issue_date:string|null;due_date:string|null;currency:string;net_amount:string|number;tax_amount:string|number;gross_amount:string|number;buyer_reference?:string|null;order_reference?:string|null;delivery_date?:string|null;delivery_country?:string|null;notes?:string|null}
export type PeppolInput={document:PeppolDocument;seller:PeppolParty;buyer:PeppolParty;lines:PeppolLine[];payments?:(string|number)[];original?:{kind:string;status:string;document_number:string|null;issue_date:string|null;currency:string;counterparty_id:string|null}|null;counterparty_id?:string|null;profileApproved:boolean}
export type PeppolIssue={path:string;code:'required'|'invalid'|'mismatch'|'unsupported'|'approval'|'rounding'|'mixed_outside'}
export const peppolVatCategories=['S','Z','E','AE','K','G','O'] as const
const safeText=(value:unknown,max=500)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(value)
const present=(value:unknown)=>safeText(value)&&String(value).trim().length>0
const isoDate=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function peppolDecimal(value:unknown,scale:number):bigint{
 const text=String(value??'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')
 if(!/^\d+(?:\.\d+)?$/.test(text)||text.length>35)throw Error('Invalid decimal')
 const [whole,fraction='']=text.split('.')
 if(fraction.length>scale)throw Error('Too many decimals')
 return BigInt(whole)*BigInt('1'+'0'.repeat(scale))+BigInt(fraction.padEnd(scale,'0')||'0')
}
const round=(value:bigint,divisor:bigint)=>(value+divisor/BigInt(2))/divisor
const amount=(cents:bigint)=>`${cents/BigInt(100)}.${String(cents%BigInt(100)).padStart(2,'0')}`
const decimal=(scaled:bigint,scale:number)=>{const divisor=BigInt('1'+'0'.repeat(scale));return `${scaled/divisor}.${String(scaled%divisor).padStart(scale,'0')}`.replace(/0+$/,'').replace(/\.$/,'')}
const escape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
export const normalizeEnterprise=(value:string,country:string)=>country==='BE'?value.replace(/^BE/i,'').replace(/[.\s]/g,''):value.trim()
export function belgianEnterpriseValid(value:string):boolean{return /^\d{10}$/.test(value)&&97-Number(BigInt(value.slice(0,8))%BigInt(97))===Number(value.slice(8))}
export function peppolEndpointValid(scheme:string,value:string):boolean{
 if(!peppolEndpointSchemes.has(scheme)||!value||/\s/.test(value))return false
 const luhn=(digits:string)=>[...digits].reverse().reduce((sum,char,index)=>{const weighted=Number(char)*(index%2?2:1);return sum+weighted%10+Math.floor(weighted/10)},0)%10===0
 switch(scheme){
  case '0088':return /^\d{13}$/.test(value)&&[...value].reduce((sum,char,index)=>sum+Number(char)*(index%2?3:1),0)%10===0
  case '0192':return /^\d{9}$/.test(value)&&Number(value)>0&&(11-[...value.slice(0,-1)].reverse().reduce((sum,char,index)=>sum+Number(char)*(index%6+2),0)%11)%11===Number(value.at(-1))
  case '0184':return /^(?:DK)?\d{8}$/.test(value)
  case '0096':return /^\d{10}$/.test(value)
  case '0198':return /^DK\d{8}$/.test(value)
  case '0208':return belgianEnterpriseValid(value)
  case '0201':return /^[A-Za-z0-9]{6}$/.test(value)
  case '0210':case '9907':return /^\d{11}$/.test(value)||/^[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z0-9]{3}\d[A-Za-z]$/.test(value)
  case '0211':return /^(?:IT|it)?\d{11}$/.test(value)&&luhn(value.replace(/^IT/i,''))
  case '0007':return /^\d{10}$/.test(value)&&luhn(value)
  case '0151':return /^\d{11}$/.test(value)&&[...value].reduce((sum,char,index)=>sum+(Number(char)-(index===0?1:0))*[10,1,3,5,7,9,11,13,15,17,19][index],0)%89===0
  case '0106':return /^\d{8}$/.test(value)
  case '0190':return /^\d{20}$/.test(value)
  case '9944':return /^NL\d{9}B\d{2}$/.test(value)
  case '0217':return /^\d{12}$/.test(value)
  default:return true
 }
}
export function peppolIbanValid(value:string):boolean{
 if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value))return false
 let remainder=0
 for(const char of value.slice(4)+value.slice(0,4))for(const digit of /[A-Z]/.test(char)?String(char.charCodeAt(0)-55):char)remainder=(remainder*10+Number(digit))%97
 return remainder===1
}
export function peppolPartyIssues(party:PeppolParty,prefix:string):PeppolIssue[]{
 const issues:PeppolIssue[]=[];const add=(field:string,code:PeppolIssue['code'])=>issues.push({path:`${prefix}.${field}`,code})
 for(const key of ['name','street_address','postal_code','city','country_code','peppol_endpoint'] as const)if(!present(party[key]))add(key,'required')
 if(prefix==='seller'&&!present(party.enterprise_number))add('enterprise_number','required')
 for(const [key,value] of Object.entries(party))if(value!=null&&!safeText(value))add(key,'invalid')
 if(party.country_code&&!peppolCountries.has(party.country_code))add('country_code','invalid')
 if(prefix==='seller'&&party.country_code&&party.country_code!=='BE')add('country_code','unsupported')
 const endpoint=party.peppol_endpoint?.match(/^([^:]+):(.+)$/)
 if(party.peppol_endpoint&&(!endpoint||!peppolEndpointValid(endpoint[1],endpoint[2])))add('peppol_endpoint','invalid')
 if(party.country_code==='BE'){
  const enterprise=normalizeEnterprise(party.enterprise_number,'BE')
  if(party.enterprise_number&&!belgianEnterpriseValid(enterprise))add('enterprise_number','invalid')
  if(endpoint?.[1]==='0208'&&enterprise&&endpoint[2]!==enterprise)add('peppol_endpoint','mismatch')
  if(party.vat_number&&(!/^BE\d{10}$/.test(party.vat_number)||!belgianEnterpriseValid(party.vat_number.slice(2))))add('vat_number','invalid')
  if(party.vat_number&&enterprise&&party.vat_number!=='BE'+enterprise)add('vat_number','mismatch')
  if(party.vat_number&&endpoint?.[1]==='0208'&&party.vat_number!=='BE'+endpoint[2])add('peppol_endpoint','mismatch')
 }else if(party.vat_number&&!/^[A-Z]{2}[A-Z0-9]{2,30}$/.test(party.vat_number))add('vat_number','invalid')
 if(party.vat_number?.startsWith('NL')&&!/^NL\d{9}B\d{2}$/.test(party.vat_number))add('vat_number','invalid')
 if(party.iban&&!peppolIbanValid(party.iban))add('iban','invalid')
 return issues
}
type PreparedLine={source:PeppolLine;quantity:bigint;price:bigint;rate:bigint;net:bigint;category:string;unit:string}
export function preparePeppol(input:PeppolInput):{issues:PeppolIssue[];xml:string|null}{
 const {document:doc,seller,buyer}=input
 const issues=[...peppolPartyIssues(seller,'seller'),...peppolPartyIssues(buyer,'buyer')]
 const add=(path:string,code:PeppolIssue['code'])=>issues.push({path,code})
 if(!input.profileApproved)add('seller.approved','approval')
 if(!['approved','issued','paid'].includes(doc.status))add('document.status','approval')
 const credit=doc.kind==='credit_note'
 if(doc.kind!=='sales_invoice'&&!credit)add('document.kind','unsupported')
 if(!present(doc.document_number))add('document.document_number','required')
 if(!isoDate(doc.issue_date))add('document.issue_date','invalid')
 if((!credit&&!isoDate(doc.due_date))||(doc.due_date&&(!isoDate(doc.due_date)||String(doc.due_date)<String(doc.issue_date))))add('document.due_date','invalid')
 if(!peppolCurrencies.has(doc.currency))add('document.currency','invalid')
 if(!present(doc.buyer_reference)&&!present(doc.order_reference))add('document.buyer_reference','required')
 for(const key of ['buyer_reference','order_reference','notes'] as const)if(doc[key]!=null&&!safeText(doc[key],key==='notes'?2000:200))add('document.'+key,'invalid')
 if(credit&&(!input.original||input.original.kind!=='sales_invoice'||!['approved','issued','paid'].includes(input.original.status)||!present(input.original.document_number)||!isoDate(input.original.issue_date)||input.original.currency!==doc.currency||input.original.counterparty_id!==input.counterparty_id))add('document.original_invoice','invalid')
 const lines:PreparedLine[]=[]
 if(!input.lines.length||input.lines.length>1000)add('lines','required')
 for(const [index,line] of input.lines.entries()){
  const path=`lines.${index+1}`
  if(!present(line.description))add(path+'.description','required')
  let quantity:bigint,price:bigint,rate:bigint
  try{quantity=peppolDecimal(line.quantity,3);price=peppolDecimal(line.unit_price,4);rate=peppolDecimal(line.vat_rate,2)}catch{add(path+'.amount','invalid');continue}
  if(quantity<=BigInt(0)||rate>BigInt(10000)){add(path+'.amount','invalid');continue}
  const category=line.vat_category||(rate>BigInt(0)?'S':'')
  if(!category){add(path+'.vat_category','required');continue}
  if(!(peppolVatCategories as readonly string[]).includes(category)||(category==='S'?rate<=BigInt(0):rate!==BigInt(0)))add(path+'.vat_category','invalid')
  if(category==='E'&&!present(line.vat_exemption_reason))add(path+'.vat_exemption_reason','required')
  if(line.vat_exemption_reason&&!safeText(line.vat_exemption_reason,500))add(path+'.vat_exemption_reason','invalid')
  if(['S','Z'].includes(category)&&line.vat_exemption_reason)add(path+'.vat_exemption_reason','invalid')
  const unit=line.unit_code||'C62'
  if(!peppolUnits.has(unit))add(path+'.unit_code','invalid')
  lines.push({source:line,quantity,price,rate,category,unit,net:round(quantity*price,BigInt(100000))})
 }
 const outside=lines.some(line=>line.category==='O')
 if(outside&&lines.some(line=>line.category!=='O'))add('lines','mixed_outside')
 if(!outside&&!present(seller.vat_number)&&!present(seller.tax_registration))add('seller.vat_number','required')
 if(lines.some(line=>line.category==='K')){
  if(!seller.vat_number)add('seller.vat_number','required')
  if(!buyer.vat_number)add('buyer.vat_number','required')
  if(!isoDate(doc.delivery_date))add('document.delivery_date','required')
  if(!doc.delivery_country||!peppolCountries.has(doc.delivery_country))add('document.delivery_country','required')
 }
 if(lines.some(line=>line.category==='G')&&!seller.vat_number)add('seller.vat_number','required')
 if(lines.some(line=>line.category==='AE')&&!buyer.vat_number&&!buyer.enterprise_number)add('buyer.vat_number','required')
 if(doc.delivery_date&&!isoDate(doc.delivery_date))add('document.delivery_date','invalid')
 if(doc.delivery_country&&!peppolCountries.has(doc.delivery_country))add('document.delivery_country','invalid')
 if(Boolean(doc.delivery_date)!==Boolean(doc.delivery_country))add('document.delivery_date','required')
 if(seller.iban&&!peppolIbanValid(seller.iban))add('seller.iban','invalid')
 const groups=new Map<string,{category:string;rate:bigint;base:bigint;tax:bigint;reasons:Set<string>}>()
 for(const line of lines){const key=line.category+':'+line.rate;const group=groups.get(key)??{category:line.category,rate:line.rate,base:BigInt(0),tax:BigInt(0),reasons:new Set<string>()};group.base+=line.net;if(line.source.vat_exemption_reason)group.reasons.add(line.source.vat_exemption_reason);groups.set(key,group)}
 let net=BigInt(0),tax=BigInt(0)
 for(const group of groups.values()){group.tax=round(group.base*group.rate,BigInt(10000));net+=group.base;tax+=group.tax}
 try{if(peppolDecimal(doc.net_amount,2)!==net||peppolDecimal(doc.tax_amount,2)!==tax||peppolDecimal(doc.gross_amount,2)!==net+tax)add('document.totals','rounding');if(net+tax<=BigInt(0))add('document.totals','invalid')}catch{add('document.totals','invalid')}
 let prepaid=BigInt(0)
 try{for(const payment of input.payments??[])prepaid+=peppolDecimal(payment,2);if(prepaid>net+tax)add('document.totals','mismatch')}catch{add('document.totals','invalid')}
 if(issues.length)return {issues,xml:null}
 const tag=(name:string,value:unknown,attributes='')=>`<${name}${attributes}>${escape(value)}</${name}>`
 const money=(name:string,cents:bigint)=>tag(name,amount(cents),` currencyID="${escape(doc.currency)}"`)
 const party=(p:PeppolParty)=>{
  const [scheme,...id]=p.peppol_endpoint.split(':')
  return '<cac:Party>'+tag('cbc:EndpointID',id.join(':'),` schemeID="${escape(scheme)}"`)+
   '<cac:PartyName>'+tag('cbc:Name',p.name)+'</cac:PartyName><cac:PostalAddress>'+tag('cbc:StreetName',p.street_address)+tag('cbc:CityName',p.city)+tag('cbc:PostalZone',p.postal_code)+'<cac:Country>'+tag('cbc:IdentificationCode',p.country_code)+'</cac:Country></cac:PostalAddress>'+
   (!outside&&p.vat_number?'<cac:PartyTaxScheme>'+tag('cbc:CompanyID',p.vat_number)+'<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>':'')+
   (p.tax_registration?'<cac:PartyTaxScheme>'+tag('cbc:CompanyID',p.tax_registration)+'<cac:TaxScheme><cbc:ID>TAX</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>':'')+
   '<cac:PartyLegalEntity>'+tag('cbc:RegistrationName',p.name)+(p.enterprise_number?tag('cbc:CompanyID',normalizeEnterprise(p.enterprise_number,p.country_code)):'')+'</cac:PartyLegalEntity></cac:Party>'
 }
 const exemptionCodes:Record<string,string>={AE:'VATEX-EU-AE',K:'VATEX-EU-IC',G:'VATEX-EU-G',O:'VATEX-EU-O'}
 const taxCategory=(category:string,rate:bigint,reasons?:Set<string>)=>tag('cbc:ID',category)+(category==='O'?'':tag('cbc:Percent',decimal(rate,2)))+
  (reasons?(exemptionCodes[category]?tag('cbc:TaxExemptionReasonCode',exemptionCodes[category]):'')+(reasons.size?tag('cbc:TaxExemptionReason',[...reasons].join('; ')):''):'')+'<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>'
 const root=credit?'CreditNote':'Invoice',lineTag=credit?'CreditNoteLine':'InvoiceLine'
 const payeeIban=credit?buyer.iban:seller.iban
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+`<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`+
  tag('cbc:CustomizationID','urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0')+tag('cbc:ProfileID','urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')+tag('cbc:ID',doc.document_number)+tag('cbc:IssueDate',doc.issue_date)+(!credit?tag('cbc:DueDate',doc.due_date):'')+tag(credit?'cbc:CreditNoteTypeCode':'cbc:InvoiceTypeCode',credit?'381':'380')+
  (doc.notes?tag('cbc:Note',doc.notes):'')+tag('cbc:DocumentCurrencyCode',doc.currency)+(doc.buyer_reference?tag('cbc:BuyerReference',doc.buyer_reference):'')+
  (doc.order_reference?'<cac:OrderReference>'+tag('cbc:ID',doc.order_reference)+'</cac:OrderReference>':'')+
  (credit?'<cac:BillingReference><cac:InvoiceDocumentReference>'+tag('cbc:ID',input.original!.document_number)+tag('cbc:IssueDate',input.original!.issue_date)+'</cac:InvoiceDocumentReference></cac:BillingReference>':'')+
  '<cac:AccountingSupplierParty>'+party(seller)+'</cac:AccountingSupplierParty><cac:AccountingCustomerParty>'+party(buyer)+'</cac:AccountingCustomerParty>'+
  (doc.delivery_date?'<cac:Delivery>'+tag('cbc:ActualDeliveryDate',doc.delivery_date)+'<cac:DeliveryLocation><cac:Address><cac:Country>'+tag('cbc:IdentificationCode',doc.delivery_country)+'</cac:Country></cac:Address></cac:DeliveryLocation></cac:Delivery>':'')+
  (payeeIban?'<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>'+tag('cbc:PaymentID',doc.document_number)+'<cac:PayeeFinancialAccount>'+tag('cbc:ID',payeeIban)+'</cac:PayeeFinancialAccount></cac:PaymentMeans>':'')+
  (credit&&doc.due_date?'<cac:PaymentTerms>'+tag('cbc:Note','Due date: '+doc.due_date)+'</cac:PaymentTerms>':'')+
  '<cac:TaxTotal>'+money('cbc:TaxAmount',tax)+[...groups.values()].map(group=>'<cac:TaxSubtotal>'+money('cbc:TaxableAmount',group.base)+money('cbc:TaxAmount',group.tax)+'<cac:TaxCategory>'+taxCategory(group.category,group.rate,group.reasons)+'</cac:TaxCategory></cac:TaxSubtotal>').join('')+'</cac:TaxTotal>'+
  '<cac:LegalMonetaryTotal>'+money('cbc:LineExtensionAmount',net)+money('cbc:TaxExclusiveAmount',net)+money('cbc:TaxInclusiveAmount',net+tax)+(prepaid>BigInt(0)?money('cbc:PrepaidAmount',prepaid):'')+money('cbc:PayableAmount',net+tax-prepaid)+'</cac:LegalMonetaryTotal>'+
  lines.map((line,index)=>`<cac:${lineTag}>`+tag('cbc:ID',index+1)+tag(credit?'cbc:CreditedQuantity':'cbc:InvoicedQuantity',decimal(line.quantity,3),` unitCode="${escape(line.unit)}"`)+money('cbc:LineExtensionAmount',line.net)+'<cac:Item>'+tag('cbc:Name',line.source.description)+'<cac:ClassifiedTaxCategory>'+taxCategory(line.category,line.rate)+'</cac:ClassifiedTaxCategory></cac:Item><cac:Price>'+tag('cbc:PriceAmount',decimal(line.price,4),` currencyID="${escape(doc.currency)}"`)+'</cac:Price>'+`</cac:${lineTag}>`).join('')+`</${root}>`
 return {issues:[],xml}
}
