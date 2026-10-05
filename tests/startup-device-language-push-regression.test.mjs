import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('device language is authoritative at every fresh app start',async()=>{
 const [prefs,server]=await Promise.all([
  read('lib/locale-preferences.ts'),
  read('lib/server-locale.ts'),
 ])
 assert.match(prefs,/initialUiLocale\(\)[\s\S]*return deviceUiLocale\(\)/)
 assert.match(prefs,/initialUiLocaleSource\(\)[\s\S]*return 'device'/)
 assert.match(server,/return headerLocale\|\|cookieLocale\|\|'nl'/)
})

test('manual language applies in-session while device changes resync the app',async()=>{
 const sync=await read('components/locale-sync.tsx')
 assert.match(sync,/applyLocale\(initialUiLocale\(\) as ExtendedUiLocale,initialUiLocaleSource\(\)\)/)
 assert.match(sync,/const onDeviceLanguageChange = \(\) => \{[\s\S]*applyLocale\(deviceUiLocale\(\) as ExtendedUiLocale,'device'\)/)
 assert.doesNotMatch(sync,/onDeviceLanguageChange[\s\S]{0,180}storedUiLocaleSource\(\)==='manual'/)
})

test('all four supported locales remain selectable',async()=>{
 const [prefs,switcher]=await Promise.all([read('lib/locale-preferences.ts'),read('components/language-switcher.tsx')])
 assert.match(prefs,/\['nl','fr','en','de'\]/)
 for(const locale of ['nl','fr','en','de'])assert.match(switcher,new RegExp(`value:"${locale}"`))
})

test('push prompt appears only when notification consent is actually missing',async()=>{
 const source=await read('components/push-permission-prompt.tsx')
 assert.match(source,/Notification\.permission==="granted"/)
 assert.match(source,/enablePushNotifications\(\{requestPermission:false\}\)/)
 assert.match(source,/permissionNeedsConsent/)
 assert.match(source,/current==="default"&&permissionNeedsConsent/)
})
