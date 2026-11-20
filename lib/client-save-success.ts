import { toast } from 'sonner'

export function showSaveSuccess(){
  const locale=(document.documentElement.lang||'nl').toLowerCase()
  const message=locale.startsWith('fr')
    ? 'Enregistré avec succès.'
    : locale.startsWith('de')
      ? 'Erfolgreich gespeichert.'
      : locale.startsWith('en')
        ? 'Saved successfully.'
        : 'Succesvol opgeslagen.'
  toast.success(message)
}
