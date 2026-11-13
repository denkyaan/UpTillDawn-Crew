"use client"
import {useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

const copy={
 nl:{button:"Banktransacties ophalen (Ponto)",busy:"Bankgegevens veilig controleren…",success:"Bankregels gecontroleerd",added:"nieuw",skipped:"al aanwezig",accounts:"bankrekening(en)",caution:"Import gaat naar het afstemmingsregister. Facturen worden niet automatisch betaald verklaard.",error:"De Ponto-import kon niet worden voltooid. Er zijn geen nieuwe factuurbetalingen geboekt.",not_configured:"Stel Ponto eerst in bij Bankzaken.",needs_account_access:"Verbind eerst een bankrekening met deze Ponto-integratie.",ponto_no_eur_accounts:"Er is geen toegankelijke EUR-rekening.",ponto_transaction_limit:"Te veel transacties voor één veilige import. Gebruik voorlopig de bestaande CSV-import.",ponto_account_limit_or_invalid:"Te veel bankrekeningen of ongeldige rekeninggegevens. Gebruik voorlopig CSV.",conflicting_transaction:"Een bestaande bankregel wijkt af. Er is niets geïmporteerd; controleer het register."},
 fr:{button:"Récupérer les transactions (Ponto)",busy:"Vérification des données bancaires…",success:"Transactions bancaires contrôlées",added:"nouvelles",skipped:"déjà présentes",accounts:"compte(s) bancaire(s)",caution:"Import vers le registre de rapprochement. Aucune facture n'est marquée payée automatiquement.",error:"Impossible de terminer l’import Ponto. Aucun paiement de facture n’a été comptabilisé.",not_configured:"Configurez d’abord Ponto dans Banque.",needs_account_access:"Autorisez d’abord un compte bancaire pour cette intégration Ponto.",ponto_no_eur_accounts:"Aucun compte EUR accessible.",ponto_transaction_limit:"Trop de transactions pour une importation sécurisée. Utilisez l’import CSV existant.",ponto_account_limit_or_invalid:"Trop de comptes ou données de compte invalides. Utilisez l’import CSV.",conflicting_transaction:"Une ligne bancaire existante diffère. Aucune importation effectuée."},
 en:{button:"Fetch bank transactions (Ponto)",busy:"Checking bank data securely…",success:"Bank entries checked",added:"new",skipped:"already present",accounts:"bank account(s)",caution:"Imported into the review ledger. No invoice is automatically marked paid.",error:"Ponto import could not finish. No invoice payments were recorded.",not_configured:"Set up Ponto under Banking first.",needs_account_access:"Authorize a bank account for this Ponto integration first.",ponto_no_eur_accounts:"No authorized EUR account available.",ponto_transaction_limit:"Too many transactions for one safe import. Use the existing CSV import.",ponto_account_limit_or_invalid:"Too many bank accounts or invalid account data. Use the existing CSV import.",conflicting_transaction:"An existing bank entry conflicts. Nothing was imported."},
 de:{button:"Banktransaktionen abrufen (Ponto)",busy:"Bankdaten werden sicher geprüft…",success:"Bankeinträge geprüft",added:"neu",skipped:"bereits vorhanden",accounts:"Bankkonto(en)",caution:"Import nur in das Abgleichsregister. Rechnungen werden nicht automatisch als bezahlt markiert.",error:"Der Ponto-Import konnte nicht abgeschlossen werden. Keine Rechnungszahlung wurde verbucht.",not_configured:"Ponto zunächst unter Bankwesen einrichten.",needs_account_access:"Zuerst ein Bankkonto für diese Ponto-Integration autorisieren.",ponto_no_eur_accounts:"Kein freigegebenes EUR-Konto verfügbar.",ponto_transaction_limit:"Zu viele Transaktionen für einen sicheren Import. CSV-Import verwenden.",ponto_account_limit_or_invalid:"Zu viele Bankkonten oder ungültige Daten. CSV-Import verwenden.",conflicting_transaction:"Ein vorhandener Bankeintrag weicht ab. Nichts wurde importiert."}
} as const

export default function PontoBankSync({locale,onImported}:{locale:SupportedUiLocale;onImported:()=>void}){
 const t=copy[locale],[busy,setBusy]=useState(false)
 const [report,setReport]=useState<{inserted:number;skipped:number;accountCount:number}|null>(null)
 const [error,setError]=useState("")
 async function sync(){
  if(busy)return
  setBusy(true);setReport(null);setError("")
  try{
   const response=await fetch("/api/administration/ponto/sync",{
    method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",cache:"no-store",body:"{}"
   })
   const payload:unknown=await response.json()
   if(!payload||typeof payload!=="object")throw Error("unknown")
   if(!response.ok){
    const reason="error" in payload&&typeof payload.error==="string"?payload.error:"unknown"
    setError(reason in t?reason:"unknown");return
   }
   if(!("result" in payload)||!payload.result||typeof payload.result!=="object"||
      !("inserted" in payload.result)||!("skipped" in payload.result)||
      typeof payload.result.inserted!=="number"||typeof payload.result.skipped!=="number"||
      !Number.isSafeInteger(payload.result.inserted)||!Number.isSafeInteger(payload.result.skipped)||
      !("accountCount" in payload)||typeof payload.accountCount!=="number"||
      !Number.isSafeInteger(payload.accountCount))throw Error("unknown")
   setReport({inserted:payload.result.inserted,skipped:payload.result.skipped,accountCount:payload.accountCount})
   onImported()
  }catch{setError("unknown")}
  finally{setBusy(false)}
 }
 const selected=error in t?t[error as keyof typeof t]:t.error
 return <div className="space-y-2 rounded-xl border p-3">
  <button type="button" disabled={busy} onClick={()=>void sync()} className="min-h-11 rounded-lg border border-violet-500 px-3 py-2 text-sm font-semibold text-violet-400 disabled:opacity-50">{busy?t.busy:t.button}</button>
  <p className="text-xs text-muted-foreground">{t.caution}</p>
  {report&&<p role="status" className="text-sm text-emerald-600">{t.success}: {report.inserted} {t.added} · {report.skipped} {t.skipped} · {report.accountCount} {t.accounts}</p>}
  {error&&<p role="alert" className="text-sm text-amber-600">{selected}</p>}
 </div>
}
