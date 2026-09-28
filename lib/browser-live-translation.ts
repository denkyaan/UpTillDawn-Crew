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

export async function liveTranslateText(text:string,targetLanguage:LiveTranslationLocale){
  const browser=globalThis as unknown as {
    LanguageDetector?:BrowserLanguageDetector
    Translator?:BrowserTranslator
  }
  if(!browser.LanguageDetector||!browser.Translator){
    throw new Error('LIVE_TRANSLATION_UNAVAILABLE')
  }
  const detector=await browser.LanguageDetector.create()
  const detections=await detector.detect(text)
  const sourceLanguage=baseLanguage(detections[0]?.detectedLanguage)
  if(!sourceLanguage)throw new Error('LANGUAGE_DETECTION_FAILED')
  if(sourceLanguage===targetLanguage)return text
  const translator=await browser.Translator.create({sourceLanguage,targetLanguage})
  return translator.translate(text)
}
