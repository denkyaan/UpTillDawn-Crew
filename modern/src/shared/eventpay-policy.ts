// Pure, browser-safe cart math for a FUTURE EventPay provider integration.
// No wallet reads, vendor endpoint, RFID parser, payment mutation or persistence.
// Do not mistake a local estimate or a candidate receipt for actual payment.
export type CartKind="bar"|"merch"
export type ProductQuote={productId:string;kind:CartKind;unitPriceCents:number;currency:"EUR"}
export type CartChoice={productId:string;quantity:number}
export type LocalCartQuote={kind:CartKind;lineCount:number;totalCents:number;
 items:{productId:string;quantity:number;unitPriceCents:number;lineCents:number}[]}
const productId=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const int=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)
export function quoteLocalCart(kind:CartKind,choices:readonly CartChoice[],
 catalogue:readonly ProductQuote[]):LocalCartQuote{
 if(kind!=="bar"&&kind!=="merch")throw Error("invalid_cart_kind")
 if(choices.length<1||choices.length>40||catalogue.length>150)throw Error("invalid_cart_size")
 const prices=new Map<string,ProductQuote>(),seen=new Set<string>()
 for(const product of catalogue){
  if(!productId.test(product.productId)||prices.has(product.productId)||
   product.kind!==kind||product.currency!=="EUR"||
   !int(product.unitPriceCents)||product.unitPriceCents<0||product.unitPriceCents>100000)
   throw Error("invalid_catalogue")
  prices.set(product.productId,product)
 }
 let total=0,lineCount=0
 const items=[]
 for(const choice of choices){
  if(!productId.test(choice.productId)||seen.has(choice.productId)||
   !int(choice.quantity)||choice.quantity<1||choice.quantity>100)
   throw Error("invalid_cart_item")
  seen.add(choice.productId)
  const product=prices.get(choice.productId)
  if(!product)throw Error("unknown_or_cross_category_product")
  const lineCents=product.unitPriceCents*choice.quantity
  if(!Number.isSafeInteger(lineCents))throw Error("amount_overflow")
  total+=lineCents;lineCount+=choice.quantity
  if(!Number.isSafeInteger(total)||total>10_000_000||lineCount>200)
   throw Error("cart_budget_exceeded")
  items.push({productId:choice.productId,quantity:choice.quantity,
   unitPriceCents:product.unitPriceCents,lineCents})
 }
 return {kind,lineCount,totalCents:total,items}
}
// This is an *internal normalized* future adapter contract, NOT a claim about
// official EventPay response fields. A vendor-certified adapter must validate
// its signed/attested response before creating the normalized structure.
export type ProviderChargeEvidence={
 providerTransactionId:string;providerEventId:string;providerWorkplaceId:string;
 amountCents:number;currency:"EUR";state:"confirmed"|"pending"|"failed";
 orderKind:CartKind
}
export function confirmedChargeMatches(input:unknown,expected:{
 eventId:string;workplaceId:string;amountCents:number;kind:CartKind;
 knownProviderTransactionIds:ReadonlySet<string>
}):boolean{
 if(!input||typeof input!=="object"||Array.isArray(input))return false
 const row=input as Record<string,unknown>
 if(Object.keys(row).length!==7)return false
 if(row.state!=="confirmed"||row.currency!=="EUR"||
  row.orderKind!==expected.kind||row.providerEventId!==expected.eventId||
  row.providerWorkplaceId!==expected.workplaceId||row.amountCents!==expected.amountCents||
  !int(row.amountCents)||row.amountCents<0||row.amountCents>10_000_000||
  typeof row.providerTransactionId!=="string"||
  !/^[A-Za-z0-9_-]{8,96}$/.test(row.providerTransactionId)||
  expected.knownProviderTransactionIds.has(row.providerTransactionId))return false
 return true
}
// Top-ups represent stored-value liability; never classify as a product sale.
// A separate audited provider adapter is required for actual top-up/refunds.
export function eventPayFinanceClass(kind:"topup"|"sale"|"refund"):{
 productRevenue:boolean;walletLiability:boolean
}{
 if(kind==="topup")return {productRevenue:false,walletLiability:true}
 if(kind==="sale")return {productRevenue:true,walletLiability:false}
 if(kind==="refund")return {productRevenue:false,walletLiability:false}
 throw Error("unsupported_cashless_type")
}
