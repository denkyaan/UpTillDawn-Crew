import type {ContractDocument} from "./contract-document"

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]??char)

/** Safe print-ready HTML. PDF conversion is a separate trusted server operation. */
export function renderContractPrintHtml(document:ContractDocument):string{
 const safe=escapeHtml
 const date=(value:string)=>safe(new Date(value).toISOString().slice(0,10))
 const party=(name:string,email:string,country:string|null|undefined)=>
  "<strong>"+safe(name)+"</strong><div>"+safe(email)+"</div>"+(country?"<div>"+safe(country)+"</div>":"")
 const clauses=document.clauses.map((clause,index)=>
  "<section><h2>"+(index+1)+". "+safe(clause.heading)+"</h2><p>"+safe(clause.body)+"</p></section>"
 ).join("")
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+safe(document.reference)+'</title><style>@page{size:A4;margin:22mm}body{font:12pt/1.5 Arial,sans-serif;color:#111;max-width:850px;margin:auto}h1{font-size:22pt}h2{font-size:14pt;margin-top:22pt}p{white-space:pre-wrap;overflow-wrap:anywhere}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px}.meta{color:#555}section{break-inside:avoid}.footer{margin-top:50px;border-top:1px solid #ccc;padding-top:15px;font-size:10pt}@media print{body{max-width:none}}</style></head><body>'+
  '<h1>'+safe(document.title)+'</h1><p class="meta">'+safe(document.reference)+' · '+date(document.approvedAt)+'</p>'+
  '<div class="parties"><div><h2>Issuer</h2>'+party(document.parties.issuer.name,document.parties.issuer.email,document.parties.issuer.country)+'</div>'+
  '<div><h2>Recipient</h2>'+party(document.parties.recipient.name,document.parties.recipient.email,document.parties.recipient.country)+'</div></div>'+
  '<h2>Event</h2><p>'+safe(document.event.name)+' · '+date(document.event.date)+'</p>'+clauses+
  '<div class="footer">Draft for electronic signature. Not yet signed.</div></body></html>'
}
