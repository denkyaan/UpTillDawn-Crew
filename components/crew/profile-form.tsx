'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/crew-client'
import { AddressAutocomplete } from '@/components/crew/address-autocomplete'
import { activeUiLocale, LANGUAGE_APPLIED_EVENT, type SupportedUiLocale } from '@/lib/locale-preferences'

type ProfileValues = {
  full_name?: string | null
  home_address?: string | null
  phone_number?: string | null
  date_of_birth?: string | null
  national_register_number?: string | null
  iban?: string | null
  profile_photo_url?: string | null
}

export function ProfileForm({
  id,
  initial,
  photoUrl,
  preferredWorkplaceId,
  workplaceOptions,
  isAdminProfile,
}: {
  id: string
  initial: ProfileValues
  photoUrl?: string | null
  preferredWorkplaceId?: string | null
  workplaceOptions: Array<{id:string;name:string}>
  isAdminProfile: boolean
}) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [requiredCompletion, setRequiredCompletion] = useState(false)
  const [language, setLanguage] = useState<SupportedUiLocale>('nl')
  const t = (nl:string,en:string,fr:string,de:string) => ({nl,en,fr,de})[language]
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setLanguage(activeUiLocale()))
    const apply=()=>setLanguage(activeUiLocale())
    addEventListener(LANGUAGE_APPLIED_EVENT,apply)
    return()=>{cancelAnimationFrame(frame);removeEventListener(LANGUAGE_APPLIED_EVENT,apply)}
  },[])
  const router = useRouter()

  useEffect(() => {
    let alive=true
    void createClient().rpc('upt_current_profile_completion').then(({data})=>{
      if(alive)setRequiredCompletion(Boolean(data?.[0]?.required&&!data[0].completed))
    })
    return()=>{alive=false}
  }, [])

  return <form className="space-y-4" onSubmit={async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg('')
    const form = new FormData(e.currentTarget)
    const s = createClient()
    const file = form.get('photo')
    const oldPath = initial.profile_photo_url || null
    let uploadedPath: string | null = null
    let nextPhotoPath = oldPath

    try {
      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) throw new Error(t('De profielfoto mag maximaal 5 MB zijn.','The profile photo may not exceed 5 MB.','La photo de profil ne peut pas dépasser 5 Mo.','Das Profilfoto darf höchstens 5 MB groß sein.'))
        const extByType: Record<string, string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
        const ext = extByType[file.type]
        if (!ext) throw new Error(t('Gebruik een JPG-, PNG- of WEBP-foto.','Use a JPG, PNG or WEBP photo.','Utilisez une photo JPG, PNG ou WEBP.','Verwende ein JPG-, PNG- oder WEBP-Foto.'))
        uploadedPath = `${id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await s.storage.from('profile-photos').upload(uploadedPath, file, {
          contentType: file.type,
          upsert: false,
        })
        if (uploadError) throw new Error(t('Profielfoto uploaden mislukt.','Failed to upload profile photo.','Échec du téléchargement de la photo de profil.','Profilfoto konnte nicht hochgeladen werden.'))
        nextPhotoPath = uploadedPath
      }

      const value = (name: string) => String(form.get(name) || '').trim()
      const { error } = await s.rpc('upt_update_own_profile', {
        p_full_name: value('name'),
        p_home_address: value('address') || undefined,
        p_phone_number: value('phone') || undefined,
        p_date_of_birth: value('dob') || undefined,
        p_national_register_number: value('national_register') || undefined,
        p_iban: value('iban') || undefined,
        p_profile_photo_path: nextPhotoPath || undefined,
      })
      if (error) throw new Error(t('Profiel opslaan mislukt.','Failed to save profile.','Échec de l’enregistrement du profil.','Profil konnte nicht gespeichert werden.'))

      if(!isAdminProfile){
        const preferred=value('preferred_workplace')
        const preferredName=workplaceOptions.find(option=>option.id===preferred)?.name||''
        if(preferredName)sessionStorage.setItem('uptilldawn-training-preferred-workplace',preferredName)
        else sessionStorage.removeItem('uptilldawn-training-preferred-workplace')
        const {error:preferenceError}=await s.rpc(
          'upt_set_own_workplace_preference',
          preferred?{p_workplace:preferred}:{},
        )
        if(preferenceError)throw new Error(t('Werkplekvoorkeur opslaan mislukt.','Failed to save workplace preference.','Échec de l’enregistrement du poste préféré.','Arbeitsplatzpräferenz konnte nicht gespeichert werden.'))
      }else{
        sessionStorage.removeItem('uptilldawn-training-preferred-workplace')
      }

      const {data:completion}=await s.rpc('upt_current_profile_completion')
      if(completion?.[0]?.required&&!completion[0].completed){
        const {error:completeError}=await s.rpc('upt_mark_own_profile_complete')
        if(completeError)throw new Error(t('Vul eerst alle verplichte profielvelden en een profielfoto in.','Complete all required profile fields and add a profile photo first.','Remplissez tous les champs obligatoires et ajoutez une photo de profil.','Fülle zuerst alle Pflichtfelder aus und füge ein Profilfoto hinzu.'))
        window.dispatchEvent(new Event('uptilldawn-profile-completed'))
      }

      if (uploadedPath && oldPath && oldPath !== uploadedPath) {
        await s.storage.from('profile-photos').remove([oldPath])
      }
      setMsg(t('Profiel opgeslagen.','Profile saved.','Profil enregistré.','Profil gespeichert.'))
      toast.success(t('Profiel opgeslagen.','Profile saved.','Profil enregistré.','Profil gespeichert.'))
      router.refresh()
    } catch (error) {
      if (uploadedPath) await s.storage.from('profile-photos').remove([uploadedPath])
      setMsg(error instanceof Error ? error.message : t('Opslaan mislukt.','Save failed.','Échec de l’enregistrement.','Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }}>
    {requiredCompletion&&<div className="rounded-2xl border border-violet-500/50 bg-violet-500/10 p-4"><p className="font-black">{t('Vul eerst je profiel volledig aan','Complete your profile first','Complétez d’abord votre profil','Vervollständige zuerst dein Profil')}</p><p className="mt-1 text-sm text-muted-foreground">{isAdminProfile?t('Voor beheerders zijn voor- en achternaam, profielfoto, telefoonnummer en geboortedatum verplicht.','Administrators must provide their full name, profile photo, phone number and date of birth.','Les administrateurs doivent fournir leur nom complet, leur photo, leur numéro de téléphone et leur date de naissance.','Administratoren müssen vollständigen Namen, Profilfoto, Telefonnummer und Geburtsdatum angeben.'):t('Voor personeel en verantwoordelijken zijn alle profielvelden, een werkplekvoorkeur en een profielfoto verplicht.','Staff and responsible leads must complete every profile field, choose a preferred workplace and add a photo.','Le personnel et les responsables doivent compléter tous les champs, choisir un poste préféré et ajouter une photo.','Personal und Verantwortliche müssen alle Profilfelder ausfüllen, einen bevorzugten Arbeitsplatz wählen und ein Foto hinzufügen.')}</p></div>}
    {photoUrl && <div className="overflow-hidden rounded-2xl border">
      {/* Private signed storage URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt={t('Profielfoto','Profile photo','Photo de profil','Profilfoto')} className="max-h-72 w-full object-contain bg-black/20"/>
    </div>}
    <label className="block">{t('Voor- en achternaam','Full name','Nom complet','Vollständiger Name')}<input name="name" required maxLength={200} defaultValue={initial.full_name || ''} className="mt-1 block w-full rounded-xl border bg-background p-3"/></label>
    {!isAdminProfile&&<AddressAutocomplete name="address" label={t('Adres','Address','Adresse','Adresse')} defaultValue={initial.home_address || ''} required/>}
    <label className="block">{t('Telefoon','Phone','Téléphone','Telefon')}<input name="phone" type="tel" required maxLength={40} defaultValue={initial.phone_number || ''} className="mt-1 block w-full rounded-xl border bg-background p-3"/></label>
    <label className="block">{t('Geboortedatum','Date of birth','Date de naissance','Geburtsdatum')}<input name="dob" type="date" required defaultValue={initial.date_of_birth || ''} className="mt-1 block w-full rounded-xl border bg-background p-3"/></label>
    {!isAdminProfile&&<>
      <label className="block">{t('Rijksregisternummer','National register number','Numéro de registre national','Nationalregisternummer')}<input name="national_register" required autoComplete="off" maxLength={32} defaultValue={initial.national_register_number || ''} className="mt-1 block w-full rounded-xl border bg-background p-3"/></label>
      <label className="block">{t('IBAN','IBAN','IBAN','IBAN')}<input name="iban" required autoComplete="off" maxLength={34} defaultValue={initial.iban || ''} className="mt-1 block w-full rounded-xl border bg-background p-3 uppercase"/></label>
      <label className="block">{t('Voorkeur werkplek','Preferred workplace','Poste préféré','Bevorzugter Arbeitsplatz')}
        <select name="preferred_workplace" required defaultValue={preferredWorkplaceId||''} className="mt-1 block w-full rounded-xl border bg-background p-3">
          <option value="" disabled>{t('Kies een werkplek','Choose a workplace','Choisissez un poste','Arbeitsplatz wählen')}</option>
          {workplaceOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t('Deze voorkeur helpt de planning en wordt gebruikt om bij uitval automatisch de eerstvolgende geschikte wachtlijstkandidaat voor dezelfde werkplek te kiezen.','This preference helps scheduling and prioritizes a suitable waiting-list replacement when someone drops out.','Cette préférence facilite la planification et permet de sélectionner la personne appropriée sur liste d’attente en cas d’absence.','Diese Präferenz unterstützt die Planung und priorisiert geeignete Personen auf der Warteliste bei Ausfällen.')}</p>
    </>}
    <label className="block">{t('Permanente profielfoto','Permanent profile photo','Photo de profil permanente','Dauerhaftes Profilfoto')}<input name="photo" type="file" required={!initial.profile_photo_url} accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-xl border bg-background p-3"/></label>
    {!isAdminProfile&&<p className="text-xs text-muted-foreground">{t('Adres, geboortedatum, rijksregisternummer en IBAN zijn enkel zichtbaar voor admin.','Address, date of birth, national register number and IBAN are visible only to administrators.','L’adresse, la date de naissance, le numéro de registre national et l’IBAN ne sont visibles que par les administrateurs.','Adresse, Geburtsdatum, Nationalregisternummer und IBAN sind nur für Administratoren sichtbar.')}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-violet-600 p-3 font-bold">{busy ? t('OPSLAAN…','SAVING…','ENREGISTREMENT…','SPEICHERN…') : t('PROFIEL OPSLAAN','SAVE PROFILE','ENREGISTRER LE PROFIL','PROFIL SPEICHERN')}</button>
    {msg && <p role="status">{msg}</p>}
  </form>
}
