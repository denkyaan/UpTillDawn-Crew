import Link from "next/link"
import {notFound} from "next/navigation"
import {requestUiLocale} from "@/lib/server-locale"
import {getArtistSigningDispatchPreflight} from "@/lib/administration/contract-signing-operator-preflight"

export const dynamic="force-dynamic"
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Read-only operator screen. No server action can send a contract here. */
export default async function SigningPreflightPage({params}:{
 params:Promise<{id:string;versionId:string}>
}){
 const {id,versionId}=await params
 if(!uuid.test(id)||!uuid.test(versionId))notFound()
 const locale=await requestUiLocale()
 const words=({
  nl:{title:"Controle vóór ondertekening",back:"Terug naar contract",blocked:"Verzending is nog geblokkeerd.",state:"Ondertekenstatus",missing:"Nog geen status",reasons:"Nog op te lossen",approval_missing:"Interne goedkeuring ontbreekt",signing_request_missing:"Ondertekenverzoek ontbreekt",envelope_missing:"Documenso-document ontbreekt",not_draft:"Contract staat niet meer op concept",dispatch_disabled:"Verzenden is nog niet geactiveerd",archive_verification_required:"Goedgekeurde PDF en archiefbewijs moeten nog worden gecontroleerd"},
  fr:{title:"Contrôle avant signature",back:"Retour au contrat",blocked:"L’envoi reste bloqué.",state:"Statut de signature",missing:"Aucun statut",reasons:"Points à résoudre",approval_missing:"Approbation interne manquante",signing_request_missing:"Demande de signature manquante",envelope_missing:"Document Documenso manquant",not_draft:"Le contrat n’est plus un brouillon",dispatch_disabled:"L’envoi n’est pas encore activé",archive_verification_required:"Le PDF approuvé et sa preuve d’archivage doivent être vérifiés"},
  en:{title:"Pre-signing checks",back:"Back to agreement",blocked:"Sending is still blocked.",state:"Signing status",missing:"No status yet",reasons:"Outstanding checks",approval_missing:"Internal approval missing",signing_request_missing:"Signing request missing",envelope_missing:"Documenso document missing",not_draft:"Contract is no longer a draft",dispatch_disabled:"Sending is not enabled yet",archive_verification_required:"Approved PDF and archive evidence still need verification"},
  de:{title:"Prüfung vor Unterzeichnung",back:"Zurück zum Vertrag",blocked:"Der Versand bleibt gesperrt.",state:"Signaturstatus",missing:"Noch kein Status",reasons:"Offene Prüfungen",approval_missing:"Interne Genehmigung fehlt",signing_request_missing:"Signaturanfrage fehlt",envelope_missing:"Documenso-Dokument fehlt",not_draft:"Vertrag ist kein Entwurf mehr",dispatch_disabled:"Versand ist noch nicht aktiviert",archive_verification_required:"Genehmigte PDF und Archivnachweis müssen noch geprüft werden"}
 } as const)[locale]
 const result=await getArtistSigningDispatchPreflight({bookingId:id,agreementVersionId:versionId})
 return <main className="mx-auto w-full max-w-2xl space-y-4 p-5">
  <Link href={"/portals/administration/modules/artists/"+id+"/agreement"} className="text-violet-400">{words.back}</Link>
  <h1 className="text-2xl font-bold">{words.title}</h1>
  <p role="status" className="rounded-xl border p-4">{words.blocked}</p>
  <p>{words.state}: {result.status??words.missing}</p>
  <section className="rounded-xl border p-4"><h2 className="font-semibold">{words.reasons}</h2>
   <ul className="mt-2 list-inside list-disc space-y-2">{result.reasons.map(reason=><li key={reason}>{words[reason as keyof typeof words]??reason}</li>)}</ul>
  </section>
 </main>
}
