export type PushLocale="nl"|"fr"|"en"|"de"
const copy:Record<string,{fr:string;en:string;de:string}>={
"Open incident op jouw werkplek":{fr:"Incident ouvert sur votre poste",en:"Open incident at your workplace",de:"Offener Vorfall an deinem Arbeitsplatz"},
"Taak vraagt opvolging":{fr:"Une tâche nécessite un suivi",en:"Task needs follow-up",de:"Aufgabe erfordert Nachverfolgung"},
"Een taak op jouw werkplek is te laat.":{fr:"Une tâche sur votre poste est en retard.",en:"A task at your workplace is overdue.",de:"Eine Aufgabe an deinem Arbeitsplatz ist überfällig."},
"Werkplekoverdracht wacht op jou":{fr:"Une transmission de poste vous attend",en:"Workplace handover is waiting for you",de:"Arbeitsplatzübergabe wartet auf dich"},
"Een klaargezette overdracht wacht nog op jouw acceptatie.":{fr:"Une transmission préparée attend encore votre acceptation.",en:"A prepared handover is still waiting for your acceptance.",de:"Eine vorbereitete Übergabe wartet noch auf deine Annahme."},
"Je hebt een open taak":{fr:"Vous avez une tâche ouverte",en:"You have an open task",de:"Du hast eine offene Aufgabe"},
"Bekijk je open taak.":{fr:"Consultez votre tâche ouverte.",en:"Review your open task.",de:"Prüfe deine offene Aufgabe."},
"Briefing nog bevestigen":{fr:"Briefing encore à confirmer",en:"Briefing still needs confirmation",de:"Briefing noch bestätigen"},
"Lees en bevestig je verplichte briefing vóór je shift.":{fr:"Lisez et confirmez votre briefing obligatoire avant votre service.",en:"Read and confirm your required briefing before your shift.",de:"Lies und bestätige dein verpflichtendes Briefing vor deiner Schicht."}
}
export function localizePushText(value:unknown,locale:string){
 const text=String(value||"")
 if(locale==="nl"||!["fr","en","de"].includes(locale))return text
 return copy[text]?.[locale as "fr"|"en"|"de"]||text
}
