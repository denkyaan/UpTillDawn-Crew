import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeBankStatementRegister} from '../src/api/native-bank-settlement-registers.ts'
const invoice='00000000-0000-4000-8000-000000000001',payment='00000000-0000-4000-8000-000000000002'
function signedDb(paidOn){
 const tables={
  admin_bank_statement_transactions:[],
  admin_financial_documents:[{id:invoice,document_number:'INV-1',kind:'sales_invoice',status:'issued',currency:'EUR'}],
  admin_financial_payments:[{id:payment,document_id:invoice,amount:'12.30',paid_on:paidOn,bank_reference:'TRANSFER-1'}],
  admin_provider_bank_settlements:[],
  admin_financial_payment_balances:[{document_id:invoice,outstanding_amount:'20.00'}]
 }
 return {from(name){const data=tables[name];assert.ok(data);const q={select:()=>q,in:()=>q,order:()=>q,range:()=>q,limit:()=>q,then:(resolve,reject)=>Promise.resolve({data,count:data.length,error:null}).then(resolve,reject)};return q},rpc(name){assert.equal(name,'upt_is_admin');return Promise.resolve({data:true,error:null})}}
}
test('valid Postgres date retains existing ledger candidates; malformed date fails closed',async()=>{
 const ok=await nativeBankStatementRegister(signedDb('2026-11-27'))
 assert.equal(ok.status,200)
 const data=await ok.json()
 assert.equal(data.existingPayments[0].paidOn,'2026-11-27')
 assert.equal(data.existingPayments[0].amountCents,1230)
 for(const date of ['2026-11-27T00:00:00Z','invalid'])assert.equal((await nativeBankStatementRegister(signedDb(date))).status,503)
})
