export type CompleteUiLocale = 'nl' | 'fr' | 'en' | 'de'
type Row = { fr: string; en: string; de: string }

// Canonical Dutch UI strings that were historically present only in the NL/FR/EN table.
// Keep every row complete: missing translations must never silently fall back to Dutch.
const ROWS: Record<string, Row> = {
  'Open inlogmenu': { fr: 'Ouvrir le menu de connexion', en: 'Open login menu', de: 'Anmeldemenü öffnen' },
  'Verberg wachtwoord': { fr: 'Masquer le mot de passe', en: 'Hide password', de: 'Passwort ausblenden' },
  'Toon wachtwoord': { fr: 'Afficher le mot de passe', en: 'Show password', de: 'Passwort anzeigen' },
  'Terug naar beheer': { fr: 'Retour à l’administration', en: 'Back to admin', de: 'Zurück zur Verwaltung' },
  'Edit mode': { fr: 'Mode édition', en: 'Edit mode', de: 'Bearbeitungsmodus' },
  'EDIT MODE': { fr: 'MODE ÉDITION', en: 'EDIT MODE', de: 'BEARBEITUNGSMODUS' },
  'EDIT MODE ACTIVEREN': { fr: 'ACTIVER LE MODE ÉDITION', en: 'ENABLE EDIT MODE', de: 'BEARBEITUNGSMODUS AKTIVIEREN' },
  'EDIT MODE DEACTIVEREN': { fr: 'DÉSACTIVER LE MODE ÉDITION', en: 'DISABLE EDIT MODE', de: 'BEARBEITUNGSMODUS DEAKTIVIEREN' },
  'Beheerderstoegang': { fr: 'Accès administrateur', en: 'Administrator access', de: 'Administratorzugriff' },
  'Actieve rol': { fr: 'Rôle actif', en: 'Active role', de: 'Aktive Rolle' },
  'Edit-rol': { fr: 'Rôle d’édition', en: 'Edit role', de: 'Bearbeitungsrolle' },
  'Code': { fr: 'Code', en: 'Code', de: 'Code' },
  'ONTGRENDELEN': { fr: 'DÉVERROUILLER', en: 'UNLOCK', de: 'ENTSPERREN' },
  'Evenementnaam': { fr: 'Nom de l’événement', en: 'Event name', de: 'Veranstaltungsname' },
  'Locatie': { fr: 'Lieu', en: 'Location', de: 'Ort' },
  'Adres': { fr: 'Adresse', en: 'Address', de: 'Adresse' },
  'Begin': { fr: 'Début', en: 'Start', de: 'Beginn' },
  'Einde': { fr: 'Fin', en: 'End', de: 'Ende' },
  'Archiveren': { fr: 'Archiver', en: 'Archive', de: 'Archivieren' },
  'Bewerken & GPS': { fr: 'Modifier et GPS', en: 'Edit & GPS', de: 'Bearbeiten & GPS' },
  'Evenement dupliceren': { fr: 'Dupliquer l’événement', en: 'Duplicate event', de: 'Veranstaltung duplizieren' },
  'Configuratie kopiëren': { fr: 'Copier la configuration', en: 'Copy configuration', de: 'Konfiguration kopieren' },
  'EVENEMENT AANMAKEN': { fr: 'CRÉER L’ÉVÉNEMENT', en: 'CREATE EVENT', de: 'VERANSTALTUNG ERSTELLEN' },
  'Personeel toevoegen…': { fr: 'Ajouter du personnel…', en: 'Add staff…', de: 'Personal hinzufügen…' },
  'Instructie gelezen': { fr: 'Instruction lue', en: 'Instruction read', de: 'Anweisung gelesen' },
  'INSTRUCTIE GELEZEN': { fr: 'INSTRUCTION LUE', en: 'INSTRUCTION READ', de: 'ANWEISUNG GELESEN' },
  'Gelezen': { fr: 'Lu', en: 'Read', de: 'Gelesen' },
  'Gelezen bevestigen': { fr: 'Confirmer la lecture', en: 'Confirm read', de: 'Lesen bestätigen' },
  'Wijzig instructie + nieuwe bevestiging': { fr: 'Modifier l’instruction + nouvelle confirmation', en: 'Update instruction + new confirmation', de: 'Anweisung ändern + neue Bestätigung' },
  "Foto's": { fr: 'Photos', en: 'Photos', de: 'Fotos' },
  'Foto toevoegen': { fr: 'Ajouter une photo', en: 'Add photo', de: 'Foto hinzufügen' },
  'TAAK AANMAKEN & TOEWIJZEN': { fr: 'CRÉER ET ATTRIBUER LA TÂCHE', en: 'CREATE & ASSIGN TASK', de: 'AUFGABE ERSTELLEN & ZUWEISEN' },
  'Toewijzing verwijderen': { fr: 'Supprimer l’attribution', en: 'Remove assignment', de: 'Zuweisung entfernen' },
  'NIET GESTART': { fr: 'PAS COMMENCÉ', en: 'NOT STARTED', de: 'NICHT GESTARTET' },
  'BEZIG': { fr: 'EN COURS', en: 'IN PROGRESS', de: 'IN BEARBEITUNG' },
  'VOLTOOID': { fr: 'TERMINÉ', en: 'COMPLETED', de: 'ABGESCHLOSSEN' },
  'Algemene chat': { fr: 'Discussion générale', en: 'General chat', de: 'Allgemeiner Chat' },
  'Privé gesprek': { fr: 'Conversation privée', en: 'Private chat', de: 'Privater Chat' },
  'Nieuw privégesprek': { fr: 'Nouvelle conversation privée', en: 'New private chat', de: 'Neuer privater Chat' },
  'Tik om van chat te wisselen': { fr: 'Touchez pour changer de conversation', en: 'Tap to switch chat', de: 'Tippen, um den Chat zu wechseln' },
  'Chats': { fr: 'Discussions', en: 'Chats', de: 'Chats' },
  'Typ een bericht…': { fr: 'Écrivez un message…', en: 'Type a message…', de: 'Nachricht eingeben…' },
  'Nog geen berichten in deze chat.': { fr: 'Aucun message dans cette conversation.', en: 'No messages in this chat yet.', de: 'Noch keine Nachrichten in diesem Chat.' },
  'Er zijn momenteel geen beschikbare chats.': { fr: 'Aucune conversation disponible pour le moment.', en: 'No chats are currently available.', de: 'Derzeit sind keine Chats verfügbar.' },
  'Bericht verwijderd door beheerder': { fr: 'Message supprimé par l’administrateur', en: 'Message removed by administrator', de: 'Nachricht vom Administrator entfernt' },
  'Modereer': { fr: 'Modérer', en: 'Moderate', de: 'Moderieren' },
  'URGENT': { fr: 'URGENT', en: 'URGENT', de: 'DRINGEND' },
  'ERKENNEN': { fr: 'ACCUSER RÉCEPTION', en: 'ACKNOWLEDGE', de: 'BESTÄTIGEN' },
  'Concept': { fr: 'Brouillon', en: 'Draft', de: 'Entwurf' },
  'Gearchiveerd': { fr: 'Archivé', en: 'Archived', de: 'Archiviert' },
  'Erkend': { fr: 'Pris en charge', en: 'Acknowledged', de: 'Bestätigt' },
  'Markeer gelezen': { fr: 'Marquer comme lu', en: 'Mark as read', de: 'Als gelesen markieren' },
  'OPENEN': { fr: 'OUVRIR', en: 'OPEN', de: 'ÖFFNEN' },
  'NIEUW': { fr: 'NOUVEAU', en: 'NEW', de: 'NEU' },
  'OPNIEUW SYNCHRONISEREN': { fr: 'RESYNCHRONISER', en: 'SYNC AGAIN', de: 'ERNEUT SYNCHRONISIEREN' },
  'Overzichtsgegevens konden niet volledig worden geladen.': { fr: 'Les données de l’aperçu n’ont pas pu être entièrement chargées.', en: 'Overview data could not be fully loaded.', de: 'Die Übersichtsdaten konnten nicht vollständig geladen werden.' },
  'Actuele serverstatus voor personeel, goedkeuringen, incidenten, taken en synchronisatie.': { fr: 'État actuel du serveur pour le personnel, les validations, les incidents, les tâches et la synchronisation.', en: 'Current server status for staff, approvals, incidents, tasks and synchronization.', de: 'Aktueller Serverstatus für Personal, Genehmigungen, Vorfälle, Aufgaben und Synchronisierung.' },
  'Tijdregistraties konden niet worden geladen.': { fr: 'Les enregistrements de temps n’ont pas pu être chargés.', en: 'Time records could not be loaded.', de: 'Zeiterfassungen konnten nicht geladen werden.' },
  'Tijdregistraties konden niet volledig worden geladen.': { fr: 'Les enregistrements de temps n’ont pas pu être entièrement chargés.', en: 'Time records could not be fully loaded.', de: 'Zeiterfassungen konnten nicht vollständig geladen werden.' },
}

const CANONICAL = new Map<string, string>()
for (const [nl, row] of Object.entries(ROWS)) {
  CANONICAL.set(nl, nl)
  CANONICAL.set(row.fr, nl)
  CANONICAL.set(row.en, nl)
  CANONICAL.set(row.de, nl)
}

export function translateCompleteUi(value: string, locale: CompleteUiLocale) {
  const canonical = CANONICAL.get(value) || value
  const row = ROWS[canonical]
  if (!row) return value
  return locale === 'nl' ? canonical : row[locale]
}
