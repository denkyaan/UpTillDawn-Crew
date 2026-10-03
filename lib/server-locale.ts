import { cookies, headers } from 'next/headers'
import {
  parseAcceptLanguage,
  parseUiLocale,
  type SupportedUiLocale,
} from '@/lib/locale-preferences'

export async function requestUiLocale():Promise<SupportedUiLocale>{
  const [cookieStore,headerStore]=await Promise.all([cookies(),headers()])
  const cookieLocale=parseUiLocale(cookieStore.get('uptilldawn-language')?.value)
  const headerLocale=parseAcceptLanguage(headerStore.get('accept-language'))
  // Device/browser language is authoritative on a fresh request. The cookie is
  // only a fallback for clients that do not send a usable Accept-Language.
  return headerLocale||cookieLocale||'nl'
}

export const PRODUCT_COPY={
  nl:{
    description:'Crew- en personeelsbeheer voor Up Till Dawn-evenementen.',
    staffTitle:'UP TILL DAWN Personeel',
    loginTitle:'Crew login',
    loginDescription:'Log in of maak een account aan voor het crewplatform van Up Till Dawn.',
    manifestName:'UP TILL DAWN PERSONEELSBEHEER',
    manifestDescription:'Personeelsbeheer voor Up Till Dawn-evenementen',
  },
  fr:{
    description:'Gestion des équipes et du personnel pour les événements Up Till Dawn.',
    staffTitle:'UP TILL DAWN Personnel',
    loginTitle:'Connexion Crew',
    loginDescription:'Connectez-vous ou créez un compte pour la plateforme crew de Up Till Dawn.',
    manifestName:'UP TILL DAWN GESTION DU PERSONNEL',
    manifestDescription:'Gestion du personnel pour les événements Up Till Dawn',
  },
  en:{
    description:'Crew and staff management for Up Till Dawn events.',
    staffTitle:'UP TILL DAWN Staff',
    loginTitle:'Crew login',
    loginDescription:'Log in or create an account for the Up Till Dawn crew platform.',
    manifestName:'UP TILL DAWN CREW MANAGEMENT',
    manifestDescription:'Crew management for Up Till Dawn events',
  },
  de:{
    description:'Crew- und Personalverwaltung für Up Till Dawn Veranstaltungen.',
    staffTitle:'UP TILL DAWN Personal',
    loginTitle:'Crew-Anmeldung',
    loginDescription:'Melde dich an oder erstelle ein Konto für die Crew-Plattform von Up Till Dawn.',
    manifestName:'UP TILL DAWN PERSONALVERWALTUNG',
    manifestDescription:'Personalverwaltung für Up Till Dawn Veranstaltungen',
  },
} as const
