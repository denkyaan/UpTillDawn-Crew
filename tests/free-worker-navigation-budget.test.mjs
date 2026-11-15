import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')

test('Workers Free: persistent navigation remains clickable without speculative server prefetch',()=>{
 for(const path of [
  'components/layout/sidebar.tsx',
  'components/layout/mobile-nav.tsx',
  'components/layout/topbar.tsx',
  'components/administration/administration-navigation.tsx',
  'components/layout/portal-switcher-links.tsx',
 ]){
  const source=read(path)
  assert.ok(source.includes('prefetch={false}'),path+' should not trigger unused prefetch')
  assert.ok(source.includes('href='),path+' must retain real navigation links')
 }
 const contextLink=read('components/admin/context-link.tsx')
 assert.ok(contextLink.includes('prefetch={props.prefetch ?? false}'),'contextual links can explicitly opt into prefetch')
 assert.ok(contextLink.includes('admin.setSelection(context)'),'contextual navigation still preserves selection')
 const menu=read('components/auth/login-form.tsx')
 assert.match(menu,/prefetch=\{false\} key=\{key\} href=/)
 assert.ok(menu.includes('onSubmit={nativeAction ? undefined : handleSubmit}'),'login form must still submit normally')
 assert.match(read('app/(auth)/login/page.tsx'),/prefetch=\{false\} key=\{href\} href=/)
})
