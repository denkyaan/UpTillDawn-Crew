import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {quoteLocalCart,confirmedChargeMatches,eventPayFinanceClass} from "../src/shared/eventpay-policy.ts"
const a="123e4567-e89b-42d3-a456-426614174001",b="123e4567-e89b-42d3-a456-426614174002"
const product={productId:a,kind:"bar",unitPriceCents:350,currency:"EUR"}
const choices=[{productId:a,quantity:3}]
const expected={eventId:"eventABC",workplaceId:"barABC",amountCents:1050,kind:"bar",
 knownProviderTransactionIds:new Set(["prior_TXN_01"])}
const good={providerTransactionId:"new_TXN_02",providerEventId:expected.eventId,
 providerWorkplaceId:expected.workplaceId,amountCents:1050,currency:"EUR",
 state:"confirmed",orderKind:"bar"}
test("local EUR cart quote is bounded, does not use floating prices and rejects cross-category products",()=>{
 const q=quoteLocalCart("bar",choices,[product])
 assert.equal(q.totalCents,1050)
 assert.equal(q.lineCount,3)
 assert.deepEqual(q.items,[{productId:a,quantity:3,unitPriceCents:350,lineCents:1050}])
 assert.throws(()=>quoteLocalCart("bar",choices,[{...product,kind:"merch"}]))
 assert.throws(()=>quoteLocalCart("bar",[{productId:a,quantity:-1}],[product]))
 assert.throws(()=>quoteLocalCart("bar",[{productId:a,quantity:101}],[product]))
 assert.throws(()=>quoteLocalCart("bar",[{productId:b,quantity:1}],[product]))
 assert.throws(()=>quoteLocalCart("bar",[...choices,...choices],[product]))
 assert.throws(()=>quoteLocalCart("bar",choices,[{...product,unitPriceCents:3.5}]))
 assert.throws(()=>quoteLocalCart("bar",choices,[{...product,currency:"USD"}]))
 assert.throws(()=>quoteLocalCart("tokens",choices,[product]))
})
test("only confirmed, exact amount+event+workplace+order provider evidence qualifies",()=>{
 assert.equal(confirmedChargeMatches(good,expected),true)
 for(const fake of [
  {...good,state:"pending"},{...good,state:"failed"},
  {...good,providerEventId:"other_event"},{...good,providerWorkplaceId:"other_post"},
  {...good,currency:"USD"},{...good,amountCents:1049},
  {...good,orderKind:"merch"},{...good,providerTransactionId:"prior_TXN_01"},
  {...good,providerTransactionId:""}, {...good,extra:true},
  null,undefined,{}, 
 ])assert.equal(confirmedChargeMatches(fake,expected),false)
})
test("top-ups, sales and refunds cannot be double-counted as both revenue and liability",()=>{
 assert.deepEqual(eventPayFinanceClass("topup"),{productRevenue:false,walletLiability:true})
 assert.deepEqual(eventPayFinanceClass("sale"),{productRevenue:true,walletLiability:false})
 assert.deepEqual(eventPayFinanceClass("refund"),{productRevenue:false,walletLiability:false})
 assert.throws(()=>eventPayFinanceClass("recharge"))
})
test("no EventPay payment endpoint, money mutation or runtime hookup without provider agreement",()=>{
 const code=readFileSync(new URL("../src/shared/eventpay-policy.ts",import.meta.url),"utf8")
 assert.ok(!code.includes("fetch("))
 assert.ok(!code.includes(".rpc("))
 assert.ok(!code.includes("walletBalance"))
 assert.ok(!code.includes("confirmPayment"))
 const server=readFileSync(new URL("../src/api/worker.ts",import.meta.url),"utf8")
 assert.ok(!server.includes('app.post("/api/v1/eventpay/'))
})
