import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('app/(app)/portals/promotion/staff/page.tsx','utf8')
const signer=readFileSync('lib/crew/signed-directory-photo-urls.ts','utf8')
test('promotion staff signs only RLS-directory photos with bounded storage batches',()=>{
 assert.match(page,/db\.rpc\("upt_promotion_directory"/)
 assert.match(page,/signedDirectoryPhotoUrls\(/)
 assert.match(page,/\.storage\.from\("profile-photos"\)\.createSignedUrls\(paths,expiresIn\)/)
 assert.doesNotMatch(page,/Promise\.all\(rows\.filter|createSignedUrl\(/)
 assert.match(signer,/members:readonly DirectoryPhotoMember\[\]/)
 assert.match(signer,/for\(let i=0;i<paths\.length;i\+=100\)/)
 assert.match(signer,/await signMany\(paths\.slice\(i,i\+100\),3600\)/)
 assert.match(signer,/if\(batch\.error\|\|!batch\.data\)continue/)
 assert.doesNotMatch(signer,/createPublicUrl|\.getPublicUrl/)
})
