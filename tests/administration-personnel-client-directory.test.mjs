import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('Administration personnel offloads directory reads from Next Worker but retains server authorization',()=>{
 const page=read('app/(app)/portals/administration/personnel/page.tsx')
 const layout=read('app/(app)/portals/administration/layout.tsx')
 const client=read('components/administration/administration-personnel-client.tsx')
 assert.match(page,/getCurrentUser\(\)/)
 assert.match(page,/AdministrationPersonnelClient initialLocale=\{locale\} currentUserId=\{user\.id\}/)
 assert.doesNotMatch(page,/createSignedUrl|upt_crew_directory/)
 assert.match(layout,/upt_my_portal_assignments/)
 assert.match(layout,/canOpenPortal\("administration"/)
 assert.match(client,/db\.rpc\("upt_crew_directory"\)/)
 assert.match(client,/signedDirectoryPhotoUrls\(directory,/)
 assert.match(client,/createSignedUrls\(paths,expiresIn\)/)
 assert.doesNotMatch(client,/getPublicUrl|service_role|SUPABASE_SERVICE_ROLE/)
 assert.match(client,/AdministrationPrivateChatButton/)
 assert.match(client,/if\(directoryError\)/)
 assert.match(client,/onClick=\{\(\) =>\{/)
 for(const locale of ['nl','fr','en','de'])assert.ok(client.includes(locale+':{title:'),locale)
})

test('Supabase directory and image operations stay browser-authenticated with private RLS',()=>{
 assert.match(read('lib/supabase/crew-client.ts'),/createBrowserClient/)
 assert.match(read('lib/crew/signed-directory-photo-urls.ts'),/for\(let i=0;i<paths\.length;i\+=100\)/)
 assert.match(read('lib/crew/signed-directory-photo-urls.ts'),/if\(batch\.error\|\|!batch\.data\)continue/)
})
