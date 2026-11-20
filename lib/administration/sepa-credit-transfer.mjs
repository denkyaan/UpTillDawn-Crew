/** Offline SEPA credit-transfer preparation. This module never submits payments. */
const xmlTextValid = value => typeof value === 'string' && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(value) && !/[\uD800-\uDFFF]/u.test(value)
const escapeXml = value => String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]))
const ibanValid = input => {
 const iban = String(input ?? '').replace(/\s/g, '').toUpperCase()
 if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
 const rearranged = iban.slice(4) + iban.slice(0,4)
 let remainder = 0
 for (const char of rearranged) {
  const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0)-55) : char
  for (const digit of digits) remainder = (remainder*10 + Number(digit)) % 97
 }
 return remainder === 1
}
const isoDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)===date
const amountCents = value => {
 const s=String(value)
 if (!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(s)) throw Error('Invalid amount')
 const [whole,fraction='']=s.split('.')
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if (!Number.isSafeInteger(cents)||cents<=0||cents>99999999999) throw Error('Amount out of range')
 return cents
}
export function prepareSepaCreditTransfer({messageId,debtorName,debtorIban,executionDate,transactions}) {
 if (!/^[A-Za-z0-9_-]{1,35}$/.test(messageId??'')) throw Error('Invalid message ID')
 if (!xmlTextValid(debtorName)||!debtorName.trim()||debtorName.length>70||!ibanValid(debtorIban)) throw Error('Invalid debtor')
 if (!isoDate(executionDate)) throw Error('Invalid execution date')
 if (!Array.isArray(transactions)||!transactions.length||transactions.length>1000) throw Error('Invalid transaction count')
 const seen=new Set()
 const rows=transactions.map(t=>{
  if (!/^[A-Za-z0-9_-]{1,35}$/.test(t.id??'')||seen.has(t.id)) throw Error('Invalid or duplicate transaction ID')
  seen.add(t.id)
  if (!xmlTextValid(t.name)||!t.name.trim()||t.name.length>70||!ibanValid(t.iban)) throw Error('Invalid beneficiary')
  if (t.remittance != null && !xmlTextValid(t.remittance)) throw Error('Invalid remittance characters')
  if (t.remittance&&t.remittance.length>140) throw Error('Remittance too long')
  return {...t,iban:t.iban.replace(/\s/g,'').toUpperCase(),cents:amountCents(t.amount)}
 })
 const total=rows.reduce((sum,row)=>sum+row.cents,0)
 if (!Number.isSafeInteger(total)) throw Error('Total exceeds safe range')
 const xml=`<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn><GrpHdr><MsgId>${escapeXml(messageId)}</MsgId><CreDtTm>${new Date().toISOString().slice(0,19)}</CreDtTm><NbOfTxs>${rows.length}</NbOfTxs><CtrlSum>${(total/100).toFixed(2)}</CtrlSum><InitgPty><Nm>${escapeXml(debtorName)}</Nm></InitgPty></GrpHdr><PmtInf><PmtInfId>${escapeXml(messageId)}</PmtInfId><PmtMtd>TRF</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${rows.length}</NbOfTxs><CtrlSum>${(total/100).toFixed(2)}</CtrlSum><PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf><ReqdExctnDt>${executionDate}</ReqdExctnDt><Dbtr><Nm>${escapeXml(debtorName)}</Nm></Dbtr><DbtrAcct><Id><IBAN>${debtorIban.replace(/\s/g,'').toUpperCase()}</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt><ChrgBr>SLEV</ChrgBr>${rows.map(t=>`<CdtTrfTxInf><PmtId><EndToEndId>${escapeXml(t.id)}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${(t.cents/100).toFixed(2)}</InstdAmt></Amt><Cdtr><Nm>${escapeXml(t.name)}</Nm></Cdtr><CdtrAcct><Id><IBAN>${t.iban}</IBAN></Id></CdtrAcct>${t.remittance?`<RmtInf><Ustrd>${escapeXml(t.remittance)}</Ustrd></RmtInf>`:''}</CdtTrfTxInf>`).join('')}</PmtInf></CstmrCdtTrfInitn></Document>`
 return {xml,count:rows.length,totalCents:total,requiresBankApproval:true}
}
export {ibanValid}
