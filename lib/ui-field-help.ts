export type UiFieldHelp={label:string;description:string}

const FIELD_HELP:Record<string,UiFieldHelp>={
 id:{label:'ID',description:'Unieke technische identificatie van dit record.'},
 event_id:{label:'Evenement',description:'Het evenement waaraan dit record gekoppeld is.'},
 workplace_id:{label:'Werkplek',description:'De werkplek waaraan dit record gekoppeld is.'},
 user_id:{label:'Gebruiker',description:'De gebruiker of medewerker waarop dit record betrekking heeft.'},
 role:{label:'Rol',description:'Bepaalt welke rechten en interface de gebruiker krijgt.'},
 role_name:{label:'Functie op werkplek',description:'De concrete functie of titel van de medewerker binnen deze werkplek of dienst.'},
 status:{label:'Status',description:'Geeft aan in welke fase dit record of proces zich bevindt.'},
 response_status:{label:'Bevestigingsstatus',description:'Geeft aan of een medewerker een dienst nog moet bevestigen, bevestigd heeft of geweigerd heeft.'},
 created_at:{label:'Aangemaakt op',description:'Datum en tijd waarop dit record werd aangemaakt.'},
 updated_at:{label:'Laatst gewijzigd',description:'Datum en tijd van de laatste wijziging.'},
 start_at:{label:'Start',description:'Geplande startdatum en -tijd.'},
 end_at:{label:'Einde',description:'Geplande einddatum en -tijd.'},
 scheduled_start:{label:'Geplande start',description:'Starttijd van de geplande dienst.'},
 scheduled_end:{label:'Gepland einde',description:'Eindtijd van de geplande dienst.'},
 approved:{label:'Goedgekeurd',description:'Bepaalt of de gebruiker toegang tot het platform heeft.'},
 account_blocked:{label:'Geblokkeerd',description:'Bepaalt of een account tijdelijk of permanent geen toegang heeft.'},
 is_active:{label:'Actief',description:'Bepaalt of dit onderdeel momenteel gebruikt en zichtbaar mag zijn.'},
 is_published:{label:'Gepubliceerd',description:'Bepaalt of gebruikers dit onderdeel kunnen zien.'},
 visible:{label:'Zichtbaar',description:'Bepaalt of het onderdeel in de interface wordt getoond.'},
 enabled:{label:'Bruikbaar',description:'Bepaalt of gebruikers het onderdeel effectief kunnen gebruiken.'},
 sort_order:{label:'Volgorde',description:'Bepaalt de positie van dit onderdeel in lijsten of navigatie.'},
 feature_key:{label:'Technische functiesleutel',description:'Interne sleutel waarmee de app deze functie herkent. Verander dit alleen als je de onderliggende logica begrijpt.'},
 audience:{label:'Doelgroep',description:'Bepaalt voor welke gebruikersgroep de functie actief is.'},
 rollout_percentage:{label:'Uitrolpercentage',description:'Percentage van de gekozen doelgroep dat de functie krijgt.'},
 notes:{label:'Notitie',description:'Interne toelichting voor beheerders.'},
 metadata:{label:'Technische details',description:'Extra systeeminformatie die door functies en automatiseringen wordt gebruikt.'},
 configuration:{label:'Configuratie',description:'Instellingen die bepalen hoe dit onderdeel zich gedraagt.'},
 settings:{label:'Instellingen',description:'Extra opties die het gedrag van deze functie beïnvloeden.'},
 payload:{label:'Actiegegevens',description:'De gegevens die bij een actie, synchronisatie of automatisering horen.'},
 error_message:{label:'Foutmelding',description:'De technische fouttekst die bij het probleem werd geregistreerd.'},
 operational_alerts:{label:'Operationele waarschuwingen',description:'Automatische signalen over problemen zoals ontbrekende verantwoordelijken, briefing, voorraad of checklists.'},
 notifications:{label:'Meldingen',description:'Berichten en waarschuwingen die gebruikers in de app ontvangen.'},
 release:{label:'Releasebeheer',description:'Controleert of een nieuwe versie technisch klaar is om veilig te publiceren.'},
 defaults:{label:'Standaardinstellingen',description:'Waarden die automatisch worden gebruikt als er nog geen specifieke instelling is gekozen.'},
 config_policy:{label:'Configuratiebeleid',description:'Regels die bepalen welke instellingen toegestaan zijn en hoe ze worden toegepast.'},
}

const FEATURE_HELP:Record<string,UiFieldHelp>={
 overview:{label:'Overzicht',description:'Centrale actiequeue met live operationele signalen, goedkeuringen, problemen en directe vervolgstappen.'},
 events:{label:'Evenementen',description:'Beheer de volledige eventlevenscyclus, briefing, readiness, documenten, afsluiting en archief.'},
 operations:{label:'Werkuren',description:'Beheer live werkuren, pauzes, check-in/out, correcties, timesheets en Excel-export.'},
 shifts:{label:'Diensten',description:'Geplande diensten en dienstbevestigingen. Voor admin geïntegreerd in Werkplaatsen & shifts.'},
 workplaces:{label:'Werkplaatsen & shifts',description:'Plan werkplekken, verantwoordelijken, personeel en shifts; open hier ook inventaris en inkommodules per werkplek.'},
 tasks:{label:'Taken',description:'Maak, wijs toe en volg operationele taken op, inclusief deadlines, checklists en escalaties.'},
 inventory:{label:'Inventaris',description:'Beheer materiaal en voorraad per werkplek, meld ontbrekend of beschadigd materiaal en bewaak minimumvoorraad.'},
 guestlist:{label:'Inkom & Guestlist',description:'Operationele inkommodule voor guests en artiesten, gekoppeld aan de betreffende werkplek.'},
 sales:{label:'Sales',description:'Volg eventomzet, merch, kassa/tokens, betaalmethodes, refunds en kasverschillen op.'},
 briefings:{label:'Briefing',description:'Beheer event- en werkplekbriefings, bevestigingen, checklists en reminders vanuit het evenement.'},
 personnel:{label:'Goedkeuringen',description:'Behandel uitsluitend nieuwe accountaanvragen en kies de initiële rol voordat toegang wordt verleend.'},
 chat:{label:'Chats',description:'Algemene, event- en werkplekcommunicatie met unread-status en contextuele navigatie.'},
 crew:{label:'Personeel',description:'Beheer goedgekeurd personeel, rollen, toegang, profielinformatie, toekomstige shifts en operationele historiek.'},
 incidents:{label:'Help',description:'Centrale hulp- en incidentqueue met erkenning, escalatie, opvolging en oplossing.'},
 emergency:{label:'Noodinformatie',description:'Noodprocedures en kritieke eventinformatie die snel beschikbaar moet zijn.'},
 documents:{label:'Documenten',description:'Documenten en bestanden die aan evenementen of werkplekken gekoppeld zijn.'},
 exports:{label:'Excel',description:'Exporteer goedgekeurde en gelockte werkuren; voor admin geïntegreerd in Werkuren.'},
 platform:{label:'Platformbeheer',description:'Geavanceerde automatisering, rollouts, recovery, AI, rapportage en technische configuratie onder Beheer.'},
 settings:{label:'Beheer',description:'Centrale beheerhub voor profiel, taal, notificaties, automatiseringen, platforminstellingen, audit en geavanceerd beheer.'},
}

export function humanizeTechnicalKey(key:string){
 return key
  .replace(/_/g,' ')
  .replace(/\b\w/g,letter=>letter.toUpperCase())
}

export function fieldHelp(key:string):UiFieldHelp{
 return FIELD_HELP[key]||{
  label:'Technisch veld',
  description:'Technisch veld dat door de app of database wordt gebruikt. Pas dit alleen aan als je weet welk proces dit veld beïnvloedt.',
 }
}

export function featureHelp(key:string,label?:string):UiFieldHelp{
 return FEATURE_HELP[key]||{
  label:label||humanizeTechnicalKey(key),
  description:'Onderdeel van de app. De instellingen hieronder bepalen voor wie het zichtbaar en bruikbaar is.',
 }
}

export function platformModuleHelp(key:string):UiFieldHelp{
 const map:Record<string,UiFieldHelp>={
  planning:{label:'Automatische personeelsplanning',description:'Maakt voorstellen voor personeelsbezetting op basis van beschikbaarheid en werkplekbehoefte. Een voorstel wordt pas actief nadat je het toepast.'},
  templates:{label:'Eventtemplates',description:'Slaat een bestaand event als herbruikbare basis op zodat werkplekken, briefing, taken, checklists en inventory opnieuw gebruikt kunnen worden.'},
  reporting:{label:'Rapportage & personeelskost',description:'Genereert eventrapporten en bewaart interne kosttarieven voor operationele ramingen.'},
  assets:{label:'Asset management',description:'Beheert codes, barcodes, serienummers, locatie, onderhoud en minimumvoorraad van materiaal.'},
  knowledge:{label:'Kennisbank',description:'Publiceert procedures en werkinstructies, eventueel offline beschikbaar voor personeel.'},
  qr:{label:'Operationele QR-resources',description:'Maakt QR-koppelingen naar werkplekken, inventory, documenten, checklists, taken of kennisartikelen.'},
  rollouts:{label:'Feature rollouts',description:'Schakelt functies gecontroleerd in voor een doelgroep en eventueel slechts voor een percentage daarvan.'},
  recovery:{label:'Configuratie, staging & recovery',description:'Bewaart configuratiesnapshots, toont herstelgereedheid en laat een eerdere configuratie terugzetten.'},
 }
 return map[key]||fieldHelp(key)
}
