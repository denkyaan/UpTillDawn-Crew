import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('every fresh app startup follows the current device language',async()=>{
 const [prefs,sync]=await Promise.all([read('lib/locale-preferences.ts'),read('components/locale-sync.tsx')])
 assert.match(prefs,/initialUiLocale[\s\S]*return deviceUiLocale\(\)/)
 assert.doesNotMatch(prefs,/storedUiLocaleSource\(\)==='manual'&&stored/)
 assert.match(sync,/applyLocale\(deviceUiLocale\(\) as ExtendedUiLocale,'device'\)/)
})
test('push prompt appears only when notification consent is actually missing',async()=>{
 const source=await read('components/push-permission-prompt.tsx')
 assert.match(source,/Notification\.permission==="granted"/)
 assert.match(source,/enablePushNotifications\(\{requestPermission:false\}\)/)
 assert.match(source,/permissionNeedsConsent/)
 assert.match(source,/current==="default"&&permissionNeedsConsent/)
})
