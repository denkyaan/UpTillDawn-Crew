import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('role tour is hydration-safe and opens real tabs without full reloads',async()=>{
  const [tour,layout,mobile,controller]=await Promise.all([
    read('components/role-app-tour.tsx'),
    read('components/layout/app-layout.tsx'),
    read('components/layout/mobile-nav.tsx'),
    read('components/training/tour-control-center.tsx'),
  ])
  assert.match(tour,/useState<ExtendedUiLocale>\("nl"\)/)
  assert.doesNotMatch(tour,/initialUiLocale\(/)
  assert.match(tour,/<TourControlCenter active=\{open&&profileGate==="ready"\}/)
  assert.doesNotMatch(tour,/router\.push\(step\.route\)/)
  assert.doesNotMatch(controller,/router\.push\(tourRoute\(role,next\)\)/)
  assert.match(controller,/awaitingNavigationRef\.current=next\.key/)
  assert.match(controller,/setNavigationTarget\(tourBaseRoute\(role,next\)\)/)
  assert.match(controller,/data-upt-training-next-tab/)
  assert.doesNotMatch(controller,/location\.assign\(/)
  assert.doesNotMatch(tour,/location\.assign\(step\.route\)/)
  assert.match(tour,/inside:\[/)
  assert.match(tour,/ROLE_FEATURES\.responsible_lead\.map/)
  assert.match(tour,/ROLE_FEATURES\.admin\.map/)
  assert.match(layout,/const currentUsable=previewAll\|\|/)
  assert.doesNotMatch(mobile,/if\(detail\?\.active\)setExpanded\(true\)/)
})

test('registration queues the PWA install prompt even before an auth session exists',async()=>{
  const [signup,prompt,helper]=await Promise.all([
    read('app/(auth)/signup/page.tsx'),
    read('components/first-use-install-prompt.tsx'),
    read('lib/pwa-install-prompt.ts'),
  ])
  assert.match(signup,/queuePwaInstallPrompt\(\)/)
  assert.match(helper,/PWA_INSTALL_PROMPT_PENDING_KEY/)
  assert.match(prompt,/localPending/)
  assert.match(prompt,/localPending\|\|accountPending/)
  assert.doesNotMatch(prompt,/if\(!visible\|\|!user\)return null/)
  assert.match(prompt,/isIos\(\)/)
  assert.match(prompt,/Add to Home Screen/)
})


test('a newly approved account completes and saves its profile before any role tour',async()=>{
  const [tour,profile]=await Promise.all([
    read('components/role-app-tour.tsx'),
    read('components/crew/profile-form.tsx'),
  ])
  const mandatory= tour.indexOf('if(state.required&&!state.completed)')
  const postponed= tour.indexOf('if(saved==="postponed")')
  const chooseChapter=tour.indexOf('const generalChapters=getTourChapters')
  assert.ok(mandatory>0,'required profile check must exist')
  assert.match(tour,/sessionStorage\.removeItem\(TOUR_SESSION_KEY\)/)
  assert.match(tour,/<TourControlCenter active=\{open&&profileGate==="ready"\}/)
  assert.match(tour,/profileGate==="ready"&&welcome/)
  assert.match(tour,/profileGate==="ready"&&choice/)
  assert.ok(mandatory<postponed,'postponed preference cannot bypass mandatory profile completion')
  assert.ok(mandatory<chooseChapter,'mandatory profile completion precedes any chapter offer')
  assert.match(tour,/router\.replace\("\/settings\?complete-profile=1"\)/)
  assert.match(profile,/upt_mark_own_profile_complete/)
  assert.match(profile,/uptilldawn-profile-completed/)
  assert.match(tour,/addEventListener\("uptilldawn-profile-completed",completed\)/)
  assert.doesNotMatch(tour,/bg-black\/60/,'the tour must not dim the entire page')
})

test('mandatory profile completion exposes explicit UI labels and validation in NL EN FR DE',async()=>{
  const profile=await read('components/crew/profile-form.tsx')
  assert.match(profile,/LANGUAGE_APPLIED_EVENT/)
  assert.match(profile,/activeUiLocale\(\)/)
  assert.match(profile,/t\('Vul eerst je profiel volledig aan','Complete your profile first','Complétez d’abord votre profil','Vervollständige zuerst dein Profil'\)/)
  assert.match(profile,/t\('PROFIEL OPSLAAN','SAVE PROFILE','ENREGISTRER LE PROFIL','PROFIL SPEICHERN'\)/)
  for(const key of ['Phone','Téléphone','Telefon','Date of birth','Date de naissance','Geburtsdatum','Preferred workplace','Poste préféré','Bevorzugter Arbeitsplatz']){
    assert.ok(profile.includes(key),'missing localized mandatory profile field: '+key)
  }
})

test('German autocomplete uses de and the mandatory onboarding gate confirms the committed status',async()=>{
  const [address,profile,tour]=await Promise.all([
    read('components/crew/address-autocomplete.tsx'),
    read('components/crew/profile-form.tsx'),
    read('components/role-app-tour.tsx'),
  ])
  assert.match(address,/\["nl","fr","en","de"\]\.includes\(htmlLang\)/)
  assert.match(address,/LANGUAGE_APPLIED_EVENT/)
  assert.match(address,/Keine Adressen gefunden/)
  assert.match(address,/Straße, Hausnummer oder Ort eingeben/)
  assert.match(profile,/data:verified,error:verifyError/)
  assert.match(profile,/verifyError\|\|!verified\?\.\[0\]\?\.completed/)
  assert.ok(profile.indexOf('data:verified,error:verifyError')<profile.indexOf("window.dispatchEvent(new Event('uptilldawn-profile-completed'))"))
  assert.ok(tour.includes('if(!state){setChoice(false);return}'),'tour cannot bypass an unavailable completion state')
})
