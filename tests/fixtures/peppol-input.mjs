// Fictional companies for isolated structural validation. No provider dispatch.
export function peppolInput(){return {
 document:{id:'00000000-0000-4000-8000-00000000f001',kind:'sales_invoice',status:'approved',document_number:'TEST-2026-001',issue_date:'2026-10-30',due_date:'2026-11-13',currency:'EUR',net_amount:'20.00',tax_amount:'4.20',gross_amount:'24.20',buyer_reference:'TEST-BUYER-REF'},
 seller:{name:'Example seller & events',street_address:'Example street 1',postal_code:'1000',city:'Brussels',country_code:'BE',enterprise_number:'0000000196',vat_number:'BE0000000196',tax_registration:'',peppol_endpoint:'0208:0000000196',iban:'BE68539007547034'},
 buyer:{name:'Example buyer',street_address:'Example street 2',postal_code:'9000',city:'Ghent',country_code:'BE',enterprise_number:'0000000295',vat_number:'BE0000000295',peppol_endpoint:'0208:0000000295'},
 lines:[{id:'line-1',description:'Event service',quantity:'2.000',unit_price:'10.0000',vat_rate:'21.00',unit_code:'HUR',vat_category:'S'}],counterparty_id:'customer-1',profileApproved:true,
}}
export function peppolSamples(){
 const samples={'invoice-standard':peppolInput()}
 for(const category of ['Z','E','AE','K','G','O']){
  const input=peppolInput();input.lines[0].vat_category=category;input.lines[0].vat_rate='0';input.document.tax_amount='0.00';input.document.gross_amount='20.00'
  if(category==='E')input.lines[0].vat_exemption_reason='Example exemption for validation'
  if(category==='K'){
   input.document.delivery_date='2026-10-29';input.document.delivery_country='NL'
   Object.assign(input.buyer,{country_code:'NL',city:'Amsterdam',postal_code:'1000AA',enterprise_number:'12345678',vat_number:'NL999999999B01',peppol_endpoint:'9944:NL999999999B01'})
  }
  samples['invoice-'+category]=input
 }
 const credit=peppolInput();credit.document.kind='credit_note';credit.original={kind:'sales_invoice',status:'issued',document_number:'TEST-2026-ORIGINAL',issue_date:'2026-10-01',currency:'EUR',counterparty_id:'customer-1'};samples['credit-standard']=credit
 const noDue=structuredClone(credit);noDue.document.due_date=null;samples['credit-no-due-date']=noDue
 const prepaid=peppolInput();prepaid.payments=['10.00'];samples['invoice-prepaid']=prepaid
 const paid=peppolInput();paid.document.status='paid';paid.payments=['24.20'];samples['invoice-paid']=paid
 const mixed=peppolInput();mixed.lines.push({...mixed.lines[0],id:'line-2',quantity:'1',vat_rate:'6'});Object.assign(mixed.document,{net_amount:'30.00',tax_amount:'4.80',gross_amount:'34.80'});samples['invoice-mixed-rates']=mixed
 const rounded=peppolInput();rounded.lines=[{...rounded.lines[0],quantity:'2.001',unit_price:'0.3333'}];Object.assign(rounded.document,{net_amount:'0.67',tax_amount:'0.14',gross_amount:'0.81'});samples['invoice-fractional']=rounded
 const grouped=peppolInput();grouped.lines=[{...grouped.lines[0],quantity:'1',unit_price:'0.03'},{...grouped.lines[0],id:'line-2',quantity:'1',unit_price:'0.03'}];Object.assign(grouped.document,{net_amount:'0.06',tax_amount:'0.01',gross_amount:'0.07'});samples['invoice-group-rounding']=grouped
 return samples
}
