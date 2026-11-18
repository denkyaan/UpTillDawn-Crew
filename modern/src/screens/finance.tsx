import {withReadBudget} from "../lib/request-budget"
import {useEffect,useState} from "react"
import {loadFinanceSummary,type FinanceSummary} from "../lib/queries"
import {useLocale} from "../lib/use-locale"

function euros(raw:string){const v=BigInt(raw);const sign=v<0n?"-":"";const abs=v<0n?-v:v;const whole=new Intl.NumberFormat("nl-BE").format(abs/100n);return sign+whole+","+String(abs%100n).padStart(2,"0")+" €"}
export default function Finance(){
 const {t}=useLocale(),[result,setResult]=useState<FinanceSummary|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let mounted=true
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),12000)
  setError(false);setResult(null)
  void withReadBudget(controller.signal,()=>loadFinanceSummary(controller.signal)).then(data=>{if(mounted)setResult(data)}).catch(()=>{if(mounted)setError(true)}).finally(()=>clearTimeout(timer))
  return()=>{mounted=false;clearTimeout(timer);controller.abort()}
 },[retry])
 return <><div className="row"><h1>{t.finance}</h1><button className="primary" onClick={()=>setRetry(n=>n+1)}>{t.refresh}</button></div>
 {!error&&!result&&<p role="status">{t.loading}</p>}
 {error&&<p className="error" role="alert">{t.unavailable} — real financial totals were not loaded.</p>}
 {result&&<section className="grid">
  <article className="card"><h2>Documents</h2><p className="number">{result.documents}</p></article>
  <article className="card"><h2>Drafts</h2><p className="number">{result.drafts}</p></article>
  <article className="card"><h2>Outstanding</h2><p className="number">{euros(result.outstanding_cents)}</p></article>
  <article className="card"><h2>Paid</h2><p className="number">{euros(result.paid_cents)}</p></article>
 </section>}
 <p className="muted">Financial approval, payment runs, Peppol and contractual signatures remain in the existing secured workflows until parity is verified.</p>
 </>
}
