import type {PracticeOperation} from "./training-exercise-catalog"
import type {TourCopy,TourLocale} from "./tour-training"

type Option={value:string;label:TourCopy}
const t=(nl:string,en:string,fr:string,de:string):TourCopy=>({nl,en,fr,de})
const opt=(value:string,nl:string,en:string,fr:string,de:string):Option=>({value,label:t(nl,en,fr,de)})
const people=[
 opt("lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"),
 opt("noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"),
 opt("mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen"),
]
const workplaces=[
 opt("bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"),
 opt("merch","Merch","Merch","Merch","Merch"),
 opt("tokens","Tokens","Tokens","Jetons","Tokens"),
 opt("entrance","Inkom & Guestlist","Entrance & Guestlist","Entrée & Liste d’invités","Eingang & Gästeliste"),
 opt("backstage","Backstage Management","Backstage Management","Gestion Backstage","Backstage Management"),
 opt("driver","Driver","Driver","Chauffeur","Fahrer"),
]
const yesNo=[opt("yes","IK KAN","I CAN","JE PEUX","ICH KANN"),opt("no","IK KAN NIET","I CANNOT","JE NE PEUX PAS","ICH KANN NICHT")]
const roles=[opt("employee","Personeel","Staff","Personnel","Personal"),opt("responsible_lead","Verantwoordelijke","Responsible lead","Responsable","Verantwortlich"),opt("admin","Admin","Admin","Admin","Admin")]
const status=[opt("planned","Gepland","Scheduled","Planifié","Geplant"),opt("active","Actief","Active","Actif","Aktiv"),opt("done","Afgesloten","Closed","Clôturé","Abgeschlossen")]
const fileOptions= [
 opt("training-briefing.pdf","training-briefing.pdf","training-briefing.pdf","training-briefing.pdf","training-briefing.pdf"),
 opt("training-prices.csv","training-prices.csv","training-prices.csv","training-prices.csv","training-prices.csv"),
 opt("training-inventory.png","training-inventory.png","training-inventory.png","training-inventory.png","training-inventory.png"),
]

/** One human-readable field contract for each action, not an unrelated generic dropdown. */
export function trainingField(step:PracticeOperation):{label:TourCopy;placeholder:TourCopy;secondary:TourCopy;options:Option[]}{
 const chapter=step.id.split(":")[0]
 const base={label:step.title,placeholder:step.title,secondary:t("Kies een categorie of koppeling","Choose a category or link","Choisir une catégorie ou un lien","Kategorie oder Zuordnung wählen"),options:workplaces}
 if(step.kind==="inspect"||step.kind==="toggle"||step.kind==="delete")return base
 if(step.id==="events:admin:0")return {...base,label:t("Naam van het evenement","Event name","Nom de l’événement","Eventname"),placeholder:t("UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée UpTillDawn","UpTillDawn Trainingsabend"),secondary:t("Evenementtype","Event type","Type d’événement","Eventtyp"),options:[opt("rave","Rave","Rave","Rave","Rave"),opt("festival","Festival","Festival","Festival","Festival"),opt("party","Feest","Party","Fête","Party")]}
 if(step.id==="workplaces:admin:10")return {...base,label:t("Naam Driver-rit","Driver trip name","Nom de la mission chauffeur","Name der Fahrerfahrt"),placeholder:t("DJ Nova ophalen","Pick up DJ Nova","Prise en charge DJ Nova","DJ Nova abholen"),secondary:t("Beoogde werkplek","Target workplace","Poste concerné","Zielarbeitsplatz"),options:[workplaces.at(-1)!]}
 if(step.id==="workplaces:admin:17")return {...base,label:t("Product en prijs","Product and price","Produit et prix","Produkt und Preis"),placeholder:t("Water · 2,50 EUR","Water · 2.50 EUR","Eau · 2,50 EUR","Wasser · 2,50 EUR"),secondary:t("Prijslijst","Price list","Liste de prix","Preisliste"),options:workplaces.slice(0,3)}
 if(step.id==="personnel:admin:2"||step.id==="crew:admin:0")return {...base,options:roles}
 if(step.id.startsWith("workplaces:admin:")&&["2","4","5","8"].includes(step.id.split(":")[2]))return {...base,options:people}
 if(step.id==="workplaces:responsible_lead:1"||step.id==="tasks:admin:3"||step.id==="tasks:responsible_lead:2"||step.id==="chat:shared:4"||step.id==="chat:admin:1")return {...base,options:people}
 if(["guestlist:shared:2","guestlist:admin:2"].includes(step.id))return {...base,options:[opt("guest","Gast","Guest","Invité","Gast"),opt("artist","Artiest","Artist","Artiste","Künstler")]}
 if(["inventory:shared:4","inventory:responsible_lead:1"].includes(step.id))return {...base,options:[opt("good","In orde","Good","Bon état","In Ordnung"),opt("missing","Ontbreekt","Missing","Manquant","Fehlt"),opt("damaged","Beschadigd","Damaged","Abîmé","Beschädigt")]}
 if(["events:shared:3","events:shared:4","events:shared:5","events:employee:0"].includes(step.id))return {...base,options:yesNo}
 if(step.id==="events:admin:5")return {...base,options:status}
 if(step.id==="operations:admin:10")return {...base,options:[opt("daily","Dagelijks","Daily","Journalier","Täglich"),opt("weekly","Wekelijks","Weekly","Hebdomadaire","Wöchentlich")]}
 if(chapter==="incidents"&&step.kind==="select")return {...base,options:step.id.endsWith(":3")?[opt("normal","Normaal","Normal","Normal","Normal"),opt("urgent","Dringend","Urgent","Urgent","Dringend"),opt("critical","Kritiek","Critical","Critique","Kritisch")]:[opt("technical","Technisch","Technical","Technique","Technisch"),opt("safety","Veiligheid","Safety","Sécurité","Sicherheit"),opt("other","Overig","Other","Autre","Sonstige")]}
 if(chapter==="guestlist"&&step.kind==="form")return {...base,label:t("Naam gastenlijst","Guest list name","Nom de la liste d’invités","Gästelistenname"),placeholder:t("UpTillDawn Guestlist","UpTillDawn Guest List","Liste d’invités UpTillDawn","UpTillDawn Gästeliste"),secondary:t("Toegangstype","Admission type","Type d’accès","Zugangsart"),options:[opt("guest","Guests","Guests","Invités","Gäste"),opt("artist","Artiesten","Artists","Artistes","Künstler")]}
 if(chapter==="personnel"&&step.kind==="form")return {...base,options:roles}
 if(chapter==="briefings"&&step.kind==="form")return {...base,label:t("Titel briefing","Briefing title","Titre du briefing","Briefingtitel"),placeholder:t("Main Bar · shiftbriefing","Main Bar · shift briefing","Bar principal · briefing du service","Hauptbar · Schichtbriefing"),secondary:t("Briefing voor werkplek","Briefing for workplace","Briefing pour poste","Briefing für Arbeitsplatz"),options:workplaces}
 if(chapter==="tasks"&&step.kind==="form")return {...base,label:t("Titel taak","Task title","Titre de la tâche","Aufgabentitel"),placeholder:t("Koeling aanvullen","Restock fridge","Réapprovisionner les frigos","Kühlung auffüllen"),secondary:t("Werkplek","Workplace","Poste","Arbeitsplatz"),options:workplaces}
 if(chapter==="inventory"&&step.kind==="form")return {...base,label:t("Materiaal / categorie","Equipment / category","Matériel / catégorie","Material / Kategorie"),placeholder:t("Bekers","Cups","Gobelets","Becher"),secondary:t("Materiaalcategorie","Equipment category","Catégorie de matériel","Materialkategorie"),options:[opt("bar","Bar & drank","Bar & drinks","Bar et boissons","Bar & Getränke"),opt("technical","Techniek","Technology","Technique","Technik"),opt("safety","Veiligheid","Safety","Sécurité","Sicherheit")]}
 if(chapter==="workplaces"&&step.kind==="form")return {...base,label:t("Naam werkplek of opdracht","Workplace or assignment name","Nom du poste ou de la mission","Arbeitsplatz- oder Auftragsname"),placeholder:t("Main Bar","Main Bar","Bar principal","Hauptbar"),secondary:t("Werkplektype","Workplace type","Type de poste","Arbeitsplatztyp"),options:workplaces}
 if(chapter==="platform"&&step.kind==="form")return {...base,label:t("Naam automatisering of template","Automation or template name","Nom d’automatisation ou de modèle","Name der Automatisierung oder Vorlage"),placeholder:t("Melding bij vrijgekomen plek","Alert when a spot opens","Alerte de place disponible","Meldung bei freiem Platz"),secondary:t("Trigger","Trigger","Déclencheur","Auslöser"),options:[opt("availability","Vrije plaats","Open spot","Place disponible","Freier Platz"),opt("shift","Shiftwijziging","Shift change","Changement de service","Schichtwechsel"),opt("incident","Incident","Incident","Incident","Vorfall")]}
 if(chapter==="chat"&&step.kind==="select")return {...base,options:people}
 if(chapter==="exports"&&step.kind==="select")return {...base,options:step.title.nl.toLowerCase().includes("formaat")?[opt("xlsx","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)"),opt("csv","CSV","CSV","CSV","CSV"),opt("pdf","PDF","PDF","PDF","PDF")]:[opt("training-event","UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée UpTillDawn","UpTillDawn Trainingsabend")]}
 if(chapter==="settings"&&step.kind==="select")return {...base,options:[opt("nl","Nederlands","Dutch","Néerlandais","Niederländisch"),opt("en","Engels","English","Anglais","Englisch"),opt("fr","Frans","French","Français","Französisch"),opt("de","Duits","German","Allemand","Deutsch")]}
 if(chapter==="tasks"&&step.kind==="select")return {...base,options:step.title.nl.toLowerCase().includes("status")?status:workplaces}
 if(chapter==="operations"&&step.kind==="select")return {...base,options:people}
 if(chapter==="sales"&&step.kind==="select")return {...base,options:workplaces.slice(0,3)}
 if(chapter==="timesheet"&&step.kind==="select")return {...base,options:[opt("noah","Noah Jacobs · urenstaat","Noah Jacobs · timesheet","Noah Jacobs · feuille d’heures","Noah Jacobs · Stundenzettel"),opt("lina","Lina Peeters · urenstaat","Lina Peeters · timesheet","Lina Peeters · feuille d’heures","Lina Peeters · Stundenzettel")]}
 if(chapter==="crew"&&step.kind==="select")return {...base,options:people}
 if(step.kind==="upload")return {...base,options:fileOptions}
 return base
}
export function displayTrainingField(field:TourCopy,locale:TourLocale):string{return field[locale]}
