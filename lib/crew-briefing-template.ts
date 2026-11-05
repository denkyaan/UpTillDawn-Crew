/** Editable structure inspired by the supplied ACIDELICS crewbriefing; no event-specific rules are assumed. */
export const CREW_BRIEFING_TEMPLATE_TITLE = "Crewbriefing – [evenement]"

export const CREW_BRIEFING_TEMPLATE_BODY = `EVENTGEGEVENS
Evenement: [naam]
Datum: [datum]
Eventuren: [start – einde]
Adres: [locatie]

BELANGRIJK
[Verplichte veiligheidsregels, dresscode en gedragsafspraken]

ALGEMENE AFSPRAKEN
[Communicatiekanalen en verantwoordelijken]
[Materiaal, netheid en afspraken bij einde shift]

LOCATIE & BEREIKBAARHEID
[Route, parking en eventuele wegwerkzaamheden]

AANKOMST & CHECK-IN
[Aanmeldpunt en verantwoordelijke]
[Hoeveel tijd vóór de shift aanwezig zijn]
[Procedure voor aan- en afmelden]

CONTACTPERSONEN
[Rol – naam – telefoonnummer]

WERKPOSTINSTRUCTIES
[Per werkpost de taken, hulpmiddelen en escalatieprocedure]
[Inkom / Ticket Scan: Weeztix Scan gebruiken indien van toepassing]
[Bij ongeldige tickets: contacteer de verantwoordelijke; verleen niet zelfstandig toegang]

MATERIAAL & CHECKLISTS
[Materiaal ophalen, veilig bewaren en na afloop inleveren]
[Openings- en afsluitchecklist per werkpost]

AFSLUITEN & AFTEKENEN
[Overdracht, opkuis, afbouw en bevestiging van gepresteerde uren]

VRAGEN & WIJZIGINGEN
[Contactkanaal voor vragen en wijzigingen tijdens het evenement]`

export interface CrewBriefingEventContext {
 name?: string | null
 date?: string | null
 startTime?: string | null
 endTime?: string | null
 address?: string | null
 workplace?: string | null
}

function safeBriefingValue(value: string | null | undefined): string | undefined {
 const clean=value?.replace(/[\r\n\t]+/g,' ').trim()
 return clean || undefined
}

/** Pre-fill only verified event data; unresolved placeholders remain visible for review. */
export function generateCrewBriefingDraft(context: CrewBriefingEventContext) {
 const name=safeBriefingValue(context.name)
 const replacements: Array<[string,string|undefined]>=[
  ['Evenement: [naam]',name?`Evenement: ${name}`:undefined],
  ['Datum: [datum]',safeBriefingValue(context.date)?.replace(/^/,'Datum: ')],
  ['Eventuren: [start – einde]',safeBriefingValue(context.startTime)&&safeBriefingValue(context.endTime)?`Eventuren: ${safeBriefingValue(context.startTime)} – ${safeBriefingValue(context.endTime)}`:undefined],
  ['Adres: [locatie]',safeBriefingValue(context.address)?.replace(/^/,'Adres: ')],
  ['[Per werkpost de taken, hulpmiddelen en escalatieprocedure]',safeBriefingValue(context.workplace)?.replace(/^/,'Werkpost: ')]
 ]
 let body: string=CREW_BRIEFING_TEMPLATE_BODY
 for(const [placeholder,replacement] of replacements)if(replacement)body=body.replace(placeholder,replacement)
 return {title:name?CREW_BRIEFING_TEMPLATE_TITLE.replace('[evenement]',name):CREW_BRIEFING_TEMPLATE_TITLE,body}
}


/** Review markers deliberately left in a draft; never treat these as confirmed instructions. */
export function unresolvedCrewBriefingFields(body:string):string[]{
 const matches=body.match(/\[[^\]\r\n]{2,160}\]/g)||[]
 return [...new Set(matches.map(item=>item.slice(1,-1).trim()))]
}

export function crewBriefingReadiness(body:string):{ready:boolean;missing:string[]}{
 const missing=unresolvedCrewBriefingFields(body)
 return {ready:body.trim().length>0&&missing.length===0,missing}
}

/** Structured, non-blocking readiness checks; avoid treating draft instructions as verified facts. */
export function crewBriefingReview(title:string,body:string){
 const missing=[...new Set([...unresolvedCrewBriefingFields(title),...unresolvedCrewBriefingFields(body)])]
 const issues:('title'|'body'|'placeholders')[]=[]
 if(!title.trim())issues.push('title')
 if(!body.trim())issues.push('body')
 if(missing.length)issues.push('placeholders')
 return {ready:issues.length===0,issues,missing}
}
