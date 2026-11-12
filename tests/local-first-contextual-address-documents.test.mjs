import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("all existing client address forms default to editable free manual mode",()=>{
 const geo=read("components/events/geoapify-place-fields.tsx")
 const reusable=read("components/crew/address-autocomplete.tsx")
 const route=read("app/api/geocode/autocomplete/route.ts")
 assert.match(geo,/onlineLookup,setOnlineLookup\]=useState\(false\)/)
 assert.match(geo,/if\(!onlineLookup\|\|!focused/)
 assert.match(reusable,/onlineLookup,setOnlineLookup\]=useState\(false\)/)
 assert.match(reusable,/if\(!onlineLookup\|\|!focused/)
 assert.match(reusable,/onSelect\?\.\(item\)/)
 assert.match(route,/client|createClient/)
 assert.match(route,/upt_is_approved/)
 assert.doesNotMatch(reusable,/NEXT_PUBLIC_GEOAPIFY|GEOAPIFY_API_KEY/)
})
test("billing addresses share one reusable lookup and validated fields",()=>{
 const component=read("components/administration/billing-address-fields.tsx")
 const sources=[
  "app/(app)/portals/administration/counterparties/page.tsx",
  "app/(app)/portals/administration/finance/page.tsx",
  "components/administration/billing-profile.tsx",
 ]
 for(const p of sources)assert.match(read(p),/BillingAddressFields/,p)
 assert.match(read("app/(app)/portals/administration/contacts/page.tsx"),/redirect\("\/portals\/administration\/counterparties"\)/)
 for(const name of ["street_address","postal_code","city","country_code"])assert.match(component,new RegExp('name="'+name+'"'))
 const parties=read("app/(app)/portals/administration/counterparties/page.tsx")
 assert.match(parties,/checkedBillingAddress\(formData\)/)
 assert.match(parties,/\.\.\.billing/)
 assert.match(parties,/returnPath/)
 assert.match(component,/onSelect=\{choose\}/)
 assert.match(component,/autoComplete="postal-code"/)
})
test("driver assignments can use manually entered verified route metrics with no paid API",()=>{
 const form=read("components/crew/driver-transport-form.tsx")
 const actions=read("lib/actions/uptilldawn.ts")
 assert.match(form,/AddressAutocomplete name="address" required/)
 assert.match(form,/manual_travel_minutes/)
 assert.match(form,/manual_route_km/)
 assert.match(form,/use_online_route/)
 assert.match(actions,/const useOnlineRoute=fd.get\('use_online_route'\)==='on'/)
 assert.match(actions,/if\(useOnlineRoute\)\{/)
 assert.match(actions,/manual_travel_minutes/)
 assert.match(actions,/manual_route_km/)
 assert.match(actions,/expectedKm=Number\(kmRaw\)/)
 assert.match(actions,/p_estimated_drive_minutes:driveMinutes/)
 assert.match(actions,/p_expected_km:expectedKm/)
 assert.match(actions,/Vul een geldige handmatige reistijd/)
})
test("administration documents route is event-scoped and reuses the existing secure upload action",()=>{
 const documentModule=read("app/(app)/portals/administration/modules/[slug]/page.tsx")
 const wrapper=read("app/(app)/portals/administration/modules/documents/page.tsx")
 const panel=read("components/crew/event-documents-panel.tsx")
 assert.match(wrapper,/searchParams:Promise<DocumentSearchParams>/)
 assert.match(wrapper,/searchParams\}/)
 assert.match(documentModule,/documentEventId=/)
 assert.match(documentModule,/documentWorkplaceRows=/)
 assert.match(documentModule,/<EventDocumentsPanel eventId=\{documentEventId\} canManage=\{Boolean\(current.realIsAdmin\|\|current.isOwner\)\}/)
 assert.match(panel,/action=\{createEventDocument\}/)
 assert.match(panel,/createSignedUrl\(document.storage_path,600\)/)
 assert.match(panel,/shouldCacheDocumentOffline/)
 assert.match(read("supabase/functions/malware-scan/index.ts"),/scanner_unconfigured/)
})
test("geoapify provides validated structured fields without client exposure of secrets",()=>{
 const source=read("lib/geoapify.ts")
 for(const name of ["streetAddress","postalCode","city","countryCode"])assert.ok(source.includes(name),name)
 assert.match(source,/process.env.GEOAPIFY_API_KEY/)
 assert.match(source,/country_code/)
})
