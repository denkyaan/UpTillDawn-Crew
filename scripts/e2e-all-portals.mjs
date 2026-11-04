import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL;
const roles = [
  ['admin', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
  ['administration', 'E2E_ADMINISTRATION_EMAIL', 'E2E_ADMINISTRATION_PASSWORD'],
  ['staff', 'E2E_STAFF_EMAIL', 'E2E_STAFF_PASSWORD'],
  ['responsible', 'E2E_RESPONSIBLE_EMAIL', 'E2E_RESPONSIBLE_PASSWORD'],
  ['promotion', 'E2E_PROMOTION_EMAIL', 'E2E_PROMOTION_PASSWORD'],
];
const missing = roles.flatMap(([role, email, password]) => [email, password].filter(key => !process.env[key]).map(key => role + ':' + key));
if (!base || missing.length) {
  console.error('Missing E2E configuration: ' + (!base ? 'E2E_BASE_URL ' : '') + missing.join(', '));
  process.exit(1);
}
const browser = await chromium.launch({headless:true});
let failed = false;
try {
  for (const [role, email, password] of roles) {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(new URL('/login/' + role, base).href, {waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#email').fill(process.env[email]);
      await page.locator('#password').fill(process.env[password]);
      await Promise.all([
        page.waitForURL(url => !url.pathname.startsWith('/login/'), {timeout:30000}),
        page.locator('button[type=submit]').click(),
      ]);
      await page.waitForLoadState('domcontentloaded');
      if (await page.locator('body').innerText().then(t => t.trim().length < 10)) throw new Error('Empty portal');
      const visited = new Set([page.url()]);
      const links = page.locator('a[href^="/"]');
      const count = Math.min(await links.count(), 25);
      const hrefs = [];
      for (let i=0;i<count;i++) {
        const href = await links.nth(i).getAttribute('href');
        if (href && !href.startsWith('/api/') && !href.includes('logout')) hrefs.push(href);
      }
      for (const href of [...new Set(hrefs)].slice(0,12)) {
        await page.goto(new URL(href,base).href,{waitUntil:'domcontentloaded',timeout:20000});
        if (page.url().includes('/login/')) throw new Error('Unexpected login redirect from ' + href);
        if (await page.locator('body').innerText().then(t => t.trim().length < 10)) throw new Error('Empty page at ' + href);
        visited.add(page.url());
      }
      if (errors.length) throw new Error('Browser exceptions: ' + errors.slice(0,3).join('; '));
      console.log('PASS '+role+': authenticated; '+visited.size+' portal pages inspected');
    } catch (e) {
      failed = true;
      console.error('FAIL '+role+': '+e.message);
      await page.screenshot({path:'e2e-'+role+'.png',fullPage:true}).catch(()=>{});
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
if (failed) process.exit(1);
