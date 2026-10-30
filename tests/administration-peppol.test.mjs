import test from 'node:test'
import assert from 'node:assert/strict'
import {preparePeppol,peppolDecimal,belgianEnterpriseValid,peppolEndpointValid} from '../lib/administration/peppol.ts'
import {peppolInput,peppolSamples} from './fixtures/peppol-input.mjs'

for(const [name,input] of Object.entries(peppolSamples()))test('Peppol prepares '+name,()=>{
 const result=preparePeppol(input);assert.deepEqual(result.issues,[]);assert.ok(result.xml?.startsWith('<?xml'));const payable=(Number(input.document.gross_amount)-(input.payments??[]).reduce((sum,value)=>sum+Number(value),0)).toFixed(2);assert.ok(result.xml.includes('<cbc:PayableAmount currencyID="EUR">'+payable+'</cbc:PayableAmount>'))
})
test('Peppol requires explicit zero-VAT treatment and approved company/invoice data',()=>{
 const input=peppolInput();input.profileApproved=false;input.document.status='draft';input.lines[0].vat_rate='0';input.lines[0].vat_category=null
 const result=preparePeppol(input);assert.equal(result.xml,null)
 for(const path of ['seller.approved','document.status','lines.1.vat_category'])assert.ok(result.issues.some(issue=>issue.path===path))
})
test('Peppol escapes names and references and rejects XML control characters',()=>{
 const input=peppolInput();input.document.buyer_reference='X<&"';input.lines[0].description='A < B & C'
 assert.ok(preparePeppol(input).xml.includes('X&lt;&amp;&quot;'))
 assert.ok(preparePeppol(input).xml.includes('A &lt; B &amp; C'))
 input.seller.name='Bad\u0000name';assert.equal(preparePeppol(input).xml,null)
 input.seller.name='Bad\ud800name';assert.equal(preparePeppol(input).xml,null)
})
test('Peppol catches changed headers and the historical per-line VAT rounding difference',()=>{
 const input=peppolSamples()['invoice-group-rounding'];input.document.tax_amount='0.02';input.document.gross_amount='0.08'
 assert.ok(preparePeppol(input).issues.some(issue=>issue.code==='rounding'))
})
test('Peppol rejects inconsistent company IDs, endpoints, countries and currencies',()=>{
 assert.equal(belgianEnterpriseValid('0000000196'),true);assert.equal(belgianEnterpriseValid('0000000197'),false)
 const input=peppolInput();input.seller.peppol_endpoint='0208:0000000295';input.document.currency='ZZZ';input.buyer.country_code='XX'
 assert.equal(preparePeppol(input).xml,null);assert.ok(preparePeppol(input).issues.some(issue=>issue.code==='mismatch'))
})
test('credit notes must refer to an approved outgoing invoice for the same buyer and currency',()=>{
 const input=peppolSamples()['credit-standard'];input.original.counterparty_id='different-buyer'
 assert.equal(preparePeppol(input).xml,null)
 input.original.counterparty_id='customer-1';input.original.kind='purchase_invoice';assert.equal(preparePeppol(input).xml,null)
})
test('outside-VAT XML omits VAT identifiers and cannot mix taxable lines',()=>{
 const input=peppolSamples()['invoice-O'];const xml=preparePeppol(input).xml
 assert.ok(!xml.includes('<cbc:CompanyID>BE'));assert.ok(xml.includes('VATEX-EU-O'))
 input.lines.push(peppolInput().lines[0]);assert.ok(preparePeppol(input).issues.some(issue=>issue.code==='mixed_outside'))
})
test('decimal arithmetic preserves stored precision and refuses negative, exponential or fractional cents',()=>{
 assert.equal(peppolDecimal('999999999.9999',4),9999999999999n)
 for(const value of ['-1','1e2','1.001','NaN',''])assert.throws(()=>peppolDecimal(value,2))
})
test('foreign recipient identifiers enforce the Peppol common format and checksum rules',()=>{
 for(const [scheme,value]of [['0088','0000000000017'],['0192','000000019'],['0184','DK00000001'],['0096','0000000001'],['0198','DK00000001'],['0208','0000000196'],['0201','abc123'],['0210','00000000001'],['0211','IT00000000018'],['0007','0000000018'],['0151','10000000000'],['9944','NL999999999B01']])assert.equal(peppolEndpointValid(scheme,value),true,scheme)
 for(const [scheme,value]of [['0088','0000000000018'],['0192','000000018'],['0184','DKabc'],['0198','00000001'],['0208','0000000197'],['0210','bad'],['0007','0000000019'],['0151','10000000001'],['9944','NLINVALID']])assert.equal(peppolEndpointValid(scheme,value),false,scheme)
})
test('recorded payments reduce the payable amount and overpayments block export',()=>{
 const input=peppolInput();input.payments=['0.10','0.20'];const xml=preparePeppol(input).xml
 assert.ok(xml.includes('<cbc:PrepaidAmount currencyID="EUR">0.30'))
 assert.ok(xml.includes('<cbc:PayableAmount currencyID="EUR">23.90'))
 input.payments=['24.21'];assert.equal(preparePeppol(input).xml,null)
})
