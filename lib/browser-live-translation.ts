export type LiveTranslationLocale = 'nl' | 'fr' | 'en' | 'de'

type Detection = { detectedLanguage?: string; confidence?: number }
type Detector = { detect(text:string):Promise<Detection[]> }
type BrowserLanguageDetector = { create():Promise<Detector> }
type BrowserTranslatorInstance = { translate(text:string):Promise<string> }
type BrowserTranslator = {
  create(options:{sourceLanguage:string;targetLanguage:string}):Promise<BrowserTranslatorInstance>
}

function baseLanguage(value:string|undefined|null){
  return value?.trim().toLowerCase().split(/[-_]/)[0] || ''
}

async function browserTranslate(text:string,targetLanguage:LiveTranslationLocale){
  const browser=globalThis as unknown as {
    LanguageDetector?:BrowserLanguageDetector
    Translator?:BrowserTranslator
  }
  if(!browser.LanguageDetector||!browser.Translator)return null
  const detector=await browser.LanguageDetector.create()
  const detections=await detector.detect(text)
  const sourceLanguage=baseLanguage(detections[0]?.detectedLanguage)
  if(!sourceLanguage)return null
  if(sourceLanguage===targetLanguage)return text
  const translator=await browser.Translator.create({sourceLanguage,targetLanguage})
  return translator.translate(text)
}

async function serverTranslate(text:string,targetLanguage:LiveTranslationLocale){
  const response=await fetch('/api/translate',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text,target:targetLanguage}),
  })
  if(!response.ok)return null
  const data=await response.json() as {translatedText?:unknown}
  return typeof data.translatedText==='string'&&data.translatedText.trim()?data.translatedText:null
}

export async function liveTranslateText(text:string,targetLanguage:LiveTranslationLocale){
  try{
    const translated=await browserTranslate(text,targetLanguage)
    if(translated)return translated
  }catch{
    // Fall through to the authenticated server provider.
  }

  try{
    const translated=await serverTranslate(text,targetLanguage)
    if(translated)return translated
  }catch{
    // The UI will show a localized unavailable message.
  }

  throw new Error('LIVE_TRANSLATION_UNAVAILABLE')
}
